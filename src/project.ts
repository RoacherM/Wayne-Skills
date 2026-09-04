import { addDays, dayOf, daysBetween, monthStart, ms, nextMonth, sortEvents, weekLabel, weekStart } from './dates.ts';
import { STAGE_EVENTS } from './types.ts';
import type { Assess, Event, Flag, HabitStats, Health, Node, NodeState, NodeStatus, Stage } from './types.ts';

export interface Tree {
  roots: NodeState[];
  all: NodeState[]; // pre-order
  byId: Map<string, NodeState>;
  today: string;
  week: string;
}

const UPPER = new Set(['objective', 'metric', 'milestone']);

/** Own status only. Views that aggregate children use this; anything that acts on a node uses `effective`. */
export function isActive(n: Node): boolean {
  return (n.status ?? 'active') === 'active';
}

interface Ctx {
  today: string;
  week: string;
  /** Position of every event in the global order; "later than" is decided by this, never by comparing ts strings. */
  seq: Map<Event, number>;
}

/** Derive everything from the two files. Pure; `today` decides health and the current week. */
export function project(nodes: Node[], events: Event[], today: string): Tree {
  const week = weekLabel(today);
  const sorted = sortEvents(events);
  const seq = new Map<Event, number>();
  sorted.forEach((e, i) => seq.set(e, i));
  const own = new Map<string, Event[]>();
  for (const e of sorted) {
    if (!e.node) continue;
    if (!own.has(e.node)) own.set(e.node, []);
    own.get(e.node)!.push(e);
  }

  const byId = new Map<string, NodeState>();
  for (const n of nodes) {
    byId.set(n.id, {
      node: n,
      parent: null,
      children: [],
      depth: 0,
      effective: 'active',
      events: own.get(n.id) ?? [],
      stage: 'todo',
      derived: null,
      assess: null,
      progress: null,
      current: null,
      elapsed: null,
      health: 'on-track',
      flags: [],
      last: null,
      lastInTree: null,
      daysSinceLast: null,
      blocked: null,
      claimed: null,
      planned: false,
      carryOver: false,
      dispatchable: false,
      undecomposed: 0,
    });
  }
  const roots: NodeState[] = [];
  for (const s of byId.values()) {
    const p = s.node.parent ? byId.get(s.node.parent) : undefined;
    if (p) {
      s.parent = p;
      p.children.push(s);
    } else roots.push(s);
  }
  const all: NodeState[] = [];
  // top-down: depth and effective status (a frozen / canceled ancestor freezes / cancels the whole subtree)
  const walk = (s: NodeState, depth: number, inherited: NodeStatus) => {
    s.depth = depth;
    s.effective = effectiveStatus(s.node.status ?? 'active', inherited);
    all.push(s);
    for (const c of s.children) walk(c, depth + 1, s.effective);
  };
  for (const r of roots) walk(r, 0, 'active');

  const ctx: Ctx = { today, week, seq };
  // bottom-up: stage, progress, last event in tree
  for (const s of [...all].reverse()) deriveOne(s, ctx);
  // top-down: dispatchable needs deps from anywhere in the tree
  for (const s of all) {
    s.dispatchable =
      s.node.kind === 'task' &&
      s.effective === 'active' &&
      s.stage !== 'done' &&
      specComplete(s.node) &&
      (s.node.deps ?? []).every((d) => {
        const dep = byId.get(d);
        return !dep || dep.stage === 'done' || dep.effective === 'canceled';
      });
  }
  return { roots, all, byId, today, week };
}

export function effectiveStatus(own: NodeStatus, inherited: NodeStatus): NodeStatus {
  if (own === 'canceled' || inherited === 'canceled') return 'canceled';
  if (own === 'frozen' || inherited === 'frozen') return 'frozen';
  return 'active';
}

export function specComplete(n: Node): boolean {
  const sp = n.spec;
  return !!sp && !!sp.goal && !!sp.accept?.length && !!sp.verify && !!sp.links?.length;
}

function deriveOne(s: NodeState, ctx: Ctx): void {
  const { today, week, seq } = ctx;
  const n = s.node;
  const ev = s.events.filter((e) => dayOf(e.ts) <= today);
  const stageEv = ev.filter((e) => STAGE_EVENTS.has(e.type));
  s.stage = stageOf(stageEv);
  s.last = ev.length ? ev[ev.length - 1] : null;
  s.lastInTree = s.last;
  for (const c of s.children) {
    if (!isActive(c.node)) continue;
    if (c.lastInTree && (!s.lastInTree || seq.get(c.lastInTree)! > seq.get(s.lastInTree)!)) s.lastInTree = c.lastInTree;
  }
  s.daysSinceLast = s.last ? daysBetween(s.last.ts, today) : null;

  const lastStage = stageEv[stageEv.length - 1];
  s.blocked = s.stage === 'blocked' && lastStage ? { since: dayOf(lastStage.ts), note: lastStage.note } : null;

  // claim holder: latest claim newer than latest submit/done/reject
  const claimIdx = stageEv.findLastIndex((e) => e.type === 'claim');
  const releaseIdx = stageEv.findLastIndex((e) => e.type === 'submit' || e.type === 'done' || e.type === 'reject');
  const claim = claimIdx >= 0 && claimIdx > releaseIdx ? stageEv[claimIdx] : undefined;
  s.claimed = claim ? { by: claim.by ?? '?', session: claim.session, ts: claim.ts } : null;

  // metric value
  if (n.kind === 'metric') {
    const v = [...ev].reverse().find((e) => e.type === 'progress' && typeof e.value === 'number');
    s.current = v ? v.value! : null;
  }

  // derived progress
  const active = s.children.filter((c) => isActive(c.node));
  s.undecomposed = active.filter((c) => c.progress === null).length;
  if (s.stage === 'done') s.derived = 1;
  else if (n.kind === 'metric') {
    const from = n.from ?? 0;
    const to = n.to ?? 1;
    s.derived = to === from ? null : clamp(((s.current ?? from) - from) / (to - from));
  } else if (n.kind === 'task' && !active.length) s.derived = s.stage === 'review' ? 0.5 : 0;
  else if (n.kind === 'habit') s.derived = null;
  else s.derived = weightedMean(active);

  // assess override and staleness
  const assess = [...ev].reverse().find((e) => e.type === 'assess' && typeof e.value === 'number');
  if (assess && UPPER.has(n.kind)) {
    const stale = staleAfter(s, assess, ctx);
    s.assess = { value: clamp(assess.value! / 100), ts: assess.ts, derived: typeof assess.derived === 'number' ? assess.derived / 100 : null, note: assess.note, stale };
  }
  s.progress = s.assess && !s.assess.stale ? s.assess.value : s.derived;

  // elapsed
  if (n.start && n.end) {
    const total = daysBetween(n.start, n.end);
    s.elapsed = total > 0 ? clamp(daysBetween(n.start, today) / total) : 1;
  }

  s.planned = n.kind === 'task' && n.week === week;
  s.carryOver = n.kind === 'task' && !!n.week && n.week < week && s.stage !== 'done' && s.effective === 'active';

  if (n.kind === 'habit') s.habit = habitStats(n, ev, today);
  s.flags = flagsOf(s, today);
  s.health = healthOf(s, today);
}

/** Stage from the node's own stage events, in stored (ts-sorted, then append) order. Position decides, so same-second sequences stay correct. */
export function stageOf(stageEv: Event[]): Stage {
  if (!stageEv.length) return 'todo';
  const lastIdx = (t: string) => stageEv.findLastIndex((e) => e.type === t);
  const done = lastIdx('done');
  const reject = lastIdx('reject');
  if (done >= 0 && done > reject) return 'done';
  if (stageEv[stageEv.length - 1].type === 'blocked') return 'blocked';
  const submit = lastIdx('submit');
  if (submit >= 0 && submit > reject) return 'review';
  return 'doing';
}

/** Whether something that changes progress landed in the active subtree after the assess event (by global order, up to today). */
function staleAfter(s: NodeState, assess: Event, ctx: Ctx): boolean {
  const after = ctx.seq.get(assess)!;
  const hit = (x: NodeState): boolean =>
    x.events.some(
      (e) => ctx.seq.get(e)! > after && dayOf(e.ts) <= ctx.today && (e.type === 'done' || e.type === 'reject' || e.type === 'submit' || e.type === 'change'),
    ) || x.children.some((c) => isActive(c.node) && hit(c));
  return hit(s);
}

function weightedMean(children: NodeState[]): number | null {
  let sum = 0;
  let w = 0;
  for (const c of children) {
    if (c.progress === null) continue;
    const cw = c.node.weight ?? 1;
    sum += c.progress * cw;
    w += cw;
  }
  return w ? sum / w : null;
}

function flagsOf(s: NodeState, today: string): Flag[] {
  const n = s.node;
  const f: Flag[] = [];
  if (n.kind !== 'task' || s.effective !== 'active' || s.stage === 'done') return f;
  if (n.deadline) {
    const left = daysBetween(today, n.deadline);
    if (left < 0) f.push('overdue');
    else if (left <= 3) f.push('due-soon');
  }
  if (s.stage === 'blocked') f.push('blocked');
  if ((s.stage === 'doing' || s.stage === 'blocked') && (s.daysSinceLast ?? 0) >= 7) f.push('stale');
  if (s.stage === 'review' && (s.daysSinceLast ?? 0) > 3) f.push('review-stale');
  if (s.claimed) f.push('claimed');
  if (s.carryOver) f.push('carry-over');
  return f;
}

function healthOf(s: NodeState, today: string): Health {
  const n = s.node;
  if (s.effective === 'canceled') return 'canceled';
  if (s.effective === 'frozen') return 'frozen';
  if (s.stage === 'done') return 'done';
  if (s.stage === 'blocked') return 'blocked';
  if (n.kind === 'habit' && s.habit) {
    const h = s.habit;
    if (h.thisPeriod >= h.times) return 'on-track';
    if (h.period === 'day') {
      // today is still open; behind means yesterday was already missed
      const y = addDays(today, -1);
      const since = n.start ?? [...h.days].sort()[0];
      return since && since <= y && !h.days.has(y) ? 'behind' : 'on-track';
    }
    return h.times - h.thisPeriod > daysLeft(h.period, today) ? 'behind' : 'on-track';
  }
  if (n.kind === 'task') {
    if (s.flags.includes('overdue')) return 'behind';
    if (s.flags.includes('stale') || s.flags.includes('review-stale')) return 'idle';
    return 'on-track';
  }
  // upper nodes
  if (s.lastInTree && daysBetween(s.lastInTree.ts, today) >= 14) return 'idle';
  if (!s.lastInTree && n.start && daysBetween(n.start, today) >= 14) return 'idle';
  if (!n.end || s.elapsed === null || s.progress === null) return 'on-track';
  const gap = s.progress - s.elapsed;
  if (gap >= -0.1) return 'on-track';
  if (gap >= -0.25) return 'at-risk';
  return 'behind';
}

function daysLeft(period: 'week' | 'month', today: string): number {
  if (period === 'week') return daysBetween(today, addDays(weekStart(today), 7));
  return daysBetween(today, nextMonth(monthStart(today)));
}

export function parseCadence(c: string | undefined): { times: number; period: 'day' | 'week' | 'month' } | null {
  if (!c) return null;
  if (c === 'daily') return { times: 1, period: 'day' };
  const m = /^(\d+)\/(week|month)$/.exec(c);
  return m ? { times: +m[1], period: m[2] as 'week' | 'month' } : null;
}

function habitStats(n: Node, ev: Event[], today: string): HabitStats {
  const cad = parseCadence(n.cadence) ?? { times: 1, period: 'week' as const };
  const days = new Set(ev.filter((e) => e.type === 'check' || e.type === 'progress').map((e) => dayOf(e.ts)));
  const periodOf = (d: string) => (cad.period === 'day' ? d : cad.period === 'week' ? weekStart(d) : monthStart(d));
  const nextPeriod = (p: string) => (cad.period === 'day' ? addDays(p, 1) : cad.period === 'week' ? addDays(p, 7) : nextMonth(p));
  const prevPeriod = (p: string) => {
    if (cad.period === 'day') return addDays(p, -1);
    if (cad.period === 'week') return addDays(p, -7);
    return monthStart(addDays(p, -1));
  };
  const count = new Map<string, number>();
  for (const d of days) {
    const p = periodOf(d);
    count.set(p, (count.get(p) ?? 0) + 1);
  }
  const cur = periodOf(today);
  const thisPeriod = count.get(cur) ?? 0;
  let streak = 0;
  let p = thisPeriod >= cad.times ? cur : prevPeriod(cur);
  while ((count.get(p) ?? 0) >= cad.times) {
    streak++;
    p = prevPeriod(p);
  }
  void nextPeriod;
  return { period: cad.period, times: cad.times, thisPeriod, streak, total: days.size, days };
}

export function clamp(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** Progress of a node as it stood on `day`, for burn-up charts. Metric: last value before day; else events only. */
export function progressAt(s: NodeState, day: string): number | null {
  const n = s.node;
  const ev = s.events.filter((e) => dayOf(e.ts) <= day);
  if (n.kind === 'metric') {
    const v = [...ev].reverse().find((e) => e.type === 'progress' && typeof e.value === 'number');
    const from = n.from ?? 0;
    const to = n.to ?? 1;
    if (stageOf(ev.filter((e) => STAGE_EVENTS.has(e.type))) === 'done') return 1;
    return to === from ? null : clamp(((v?.value ?? from) - from) / (to - from));
  }
  if (stageOf(ev.filter((e) => STAGE_EVENTS.has(e.type))) === 'done') return 1;
  if (!s.children.length) return n.kind === 'task' && stageOf(ev.filter((e) => STAGE_EVENTS.has(e.type))) === 'review' ? 0.5 : 0;
  let sum = 0;
  let w = 0;
  for (const c of s.children) {
    if (!isActive(c.node)) continue;
    const p = progressAt(c, day);
    if (p === null) continue;
    sum += p * (c.node.weight ?? 1);
    w += c.node.weight ?? 1;
  }
  return w ? sum / w : null;
}

/** Done tasks per week over the last `weeks` weeks, newest last. Hours only when someone said them. */
export function velocity(t: Tree, weeks = 4): { week: string; start: string; done: number; hours: number | null; ids: string[] }[] {
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(weekStart(t.today), -7 * i);
    const end = addDays(start, 7);
    const ids: string[] = [];
    let hours = 0;
    let anyHours = false;
    for (const s of t.all) {
      if (s.node.kind !== 'task') continue;
      const d = [...s.events].reverse().find((e) => e.type === 'done');
      if (!d || dayOf(d.ts) < start || dayOf(d.ts) >= end) continue;
      if (s.stage !== 'done') continue;
      ids.push(s.node.id);
      for (const e of s.events) if (typeof e.hours === 'number') (hours += e.hours), (anyHours = true);
    }
    out.push({ week: weekLabel(start), start, done: ids.length, hours: anyHours ? hours : null, ids });
  }
  return out;
}

/** Exact id first, then substring on id / name / area. One hit → node; otherwise candidates. */
export function matchNode(nodes: Node[], q: string): { node?: Node; candidates: Node[] } {
  const exact = nodes.find((n) => n.id === q);
  if (exact) return { node: exact, candidates: [exact] };
  const lq = q.toLowerCase();
  const hits = nodes.filter((n) => n.id.toLowerCase().includes(lq) || n.name.toLowerCase().includes(lq) || (n.area ?? '').toLowerCase().includes(lq));
  return hits.length === 1 ? { node: hits[0], candidates: hits } : { candidates: hits };
}

/** Generated ids: `<parent>.<n>` under a parent, else a kind prefix with a counter. Never reused: ids still named by events or deps stay taken. */
/** Every id that must not be issued again: live nodes, anything named in deps, and anything with history in the event log. */
export function takenIds(nodes: readonly Node[], events: readonly Event[] = []): Set<string> {
  const taken = new Set<string>(nodes.map((n) => n.id));
  for (const n of nodes) for (const d of n.deps ?? []) taken.add(d);
  for (const e of events) if (e.node) taken.add(e.node);
  return taken;
}

export function newId(nodes: Node[], kind: Node['kind'], parent?: string | null, events: readonly Event[] = []): string {
  const taken = takenIds(nodes, events);
  const prefix = parent ? `${parent}.` : { objective: 'o', metric: 'kr', milestone: 'm', task: 't', habit: 'h' }[kind];
  for (let i = 1; ; i++) {
    const id = `${prefix}${i}`;
    if (!taken.has(id)) return id;
  }
}

export function descendants(s: NodeState): NodeState[] {
  return s.children.flatMap((c) => [c, ...descendants(c)]);
}

export function isAncestor(t: Tree, ancestor: string, id: string): boolean {
  let cur = t.byId.get(id)?.parent ?? null;
  while (cur) {
    if (cur.node.id === ancestor) return true;
    cur = cur.parent;
  }
  return false;
}

export { ms };
