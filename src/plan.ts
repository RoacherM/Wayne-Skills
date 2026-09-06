import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { addDays, dayOf, daysBetween, isValidDate, isValidWeek, nowIso, parseTs, sortEvents, tsMs, weekLabel, weekMonday } from './dates.ts';
import { newId, progressAt, specComplete, takenIds, velocity } from './project.ts';
import type { Tree } from './project.ts';
import type { Event, Flag, Node, NodeKind, NodeState, Priority, Repo, Spec, Stage } from './types.ts';

// Planning data: what `week`, `brief`, `candidates`, `changes`, `commits`, `apply` and `report data` hand to the agent.
// Everything here is facts; ordering and judgement stay in the skill (DESIGN §4).

// ── proposals ──────────────────────────────────────────
export type ProposalStatus = 'none' | 'pending' | 'applied' | 'dismissed';

export interface ProposalFile {
  file: string; // basename, what plan events record in `source`
  path: string;
  week: string;
  status: Exclude<ProposalStatus, 'none'>;
  ts: string | null; // the deciding plan event
  by?: string;
}

const PLAN_FILE = /^(\d{4}-W\d{2})\.plan(?:-\d+)?\.yaml$/;

/** Every reports/<week>*.plan.yaml with its verdict: the latest plan event naming the file decides, none means pending. */
export function proposalFiles(reportsDir: string, week: string, events: readonly Event[]): ProposalFile[] {
  if (!existsSync(reportsDir)) return [];
  const plans = sortEvents(events.filter((e) => e.type === 'plan' && e.source));
  return readdirSync(reportsDir)
    .filter((f) => PLAN_FILE.test(f) && f.startsWith(week + '.'))
    .sort()
    .map((file) => {
      const last = [...plans].reverse().find((e) => e.source === file);
      return { file, path: join(reportsDir, file), week, status: !last ? 'pending' : last.dismissed ? 'dismissed' : 'applied', ts: last?.ts ?? null, by: last?.by } as ProposalFile;
    });
}

export function proposalStatus(files: readonly ProposalFile[]): ProposalStatus {
  if (!files.length) return 'none';
  if (files.some((f) => f.status === 'pending')) return 'pending';
  if (files.some((f) => f.status === 'applied')) return 'applied';
  return 'dismissed';
}

// ── task facts ─────────────────────────────────────────
export interface TaskFacts {
  id: string;
  name: string;
  path: string[]; // ancestor ids, root first
  parent: string | null;
  stage: Stage;
  priority: Priority | null;
  deadline: string | null;
  daysLeft: number | null;
  week: string | null;
  order: number | null;
  flags: Flag[];
  daysSinceLast: number | null;
  blocked: NodeState['blocked'];
  claimed: NodeState['claimed'];
  planned: boolean;
  carryOver: boolean;
  dispatchable: boolean;
}

export function taskFacts(s: NodeState, today: string): TaskFacts {
  const n = s.node;
  const path: string[] = [];
  for (let p = s.parent; p; p = p.parent) path.unshift(p.node.id);
  return {
    id: n.id,
    name: n.name,
    path,
    parent: n.parent ?? null,
    stage: s.stage,
    priority: n.priority ?? null,
    deadline: n.deadline ?? null,
    daysLeft: n.deadline ? daysBetween(today, n.deadline) : null,
    week: n.week ?? null,
    order: typeof n.order === 'number' ? n.order : null,
    flags: s.flags,
    daysSinceLast: s.daysSinceLast,
    blocked: s.blocked,
    claimed: s.claimed,
    planned: s.planned,
    carryOver: s.carryOver,
    dispatchable: s.dispatchable,
  };
}

const activeTasks = (t: Tree) => t.all.filter((s) => s.node.kind === 'task' && s.effective === 'active');

/** Planned first by `order` (unset last), then by id so the list is stable. */
export function byOrder(a: NodeState, b: NodeState): number {
  const ao = typeof a.node.order === 'number' ? a.node.order : Number.POSITIVE_INFINITY;
  const bo = typeof b.node.order === 'number' ? b.node.order : Number.POSITIVE_INFINITY;
  return ao - bo || a.node.id.localeCompare(b.node.id);
}

// ── week ───────────────────────────────────────────────
export interface WeekView {
  week: string;
  start: string;
  end: string; // Sunday
  current: boolean;
  planned: TaskFacts[];
  carryOver: TaskFacts[];
  proposal: ProposalStatus;
  proposals: ProposalFile[];
}

/** Tasks of one week: `week === label`, plus the unfinished ones whose week is earlier (carry-over relative to that week). */
export function weekView(t: Tree, events: readonly Event[], reportsDir: string, label = t.week): WeekView {
  const start = weekMonday(label)!;
  const planned = activeTasks(t)
    .filter((s) => s.node.week === label)
    .sort(byOrder)
    .map((s) => taskFacts(s, t.today));
  const carryOver = activeTasks(t)
    .filter((s) => s.stage !== 'done' && !!s.node.week && s.node.week < label)
    .sort(byOrder)
    .map((s) => taskFacts(s, t.today));
  const proposals = proposalFiles(reportsDir, label, events);
  return { week: label, start, end: addDays(start, 6), current: label === t.week, planned, carryOver, proposal: proposalStatus(proposals), proposals };
}

// ── brief ──────────────────────────────────────────────
export interface UpperFact {
  id: string;
  name: string;
  kind: NodeKind;
  health: NodeState['health'];
  progress: number | null;
  elapsed: number | null;
  daysQuiet: number | null;
}

export interface Brief {
  today: string;
  week: string;
  overdue: TaskFacts[];
  dueSoon: TaskFacts[];
  blocked: TaskFacts[];
  stale: TaskFacts[];
  reviewStale: TaskFacts[];
  claimed: TaskFacts[];
  behind: UpperFact[]; // objective / metric / milestone at-risk, behind or idle
  proposals: ProposalFile[]; // pending only
  empty: boolean;
}

export function brief(t: Tree, events: readonly Event[], reportsDir: string): Brief {
  const tasks = activeTasks(t).filter((s) => s.stage !== 'done');
  const withFlag = (f: Flag) => tasks.filter((s) => s.flags.includes(f)).map((s) => taskFacts(s, t.today));
  const behind = t.all
    .filter((s) => s.node.kind !== 'task' && s.node.kind !== 'habit' && s.effective === 'active' && (s.health === 'at-risk' || s.health === 'behind' || s.health === 'idle'))
    .map((s) => ({
      id: s.node.id,
      name: s.node.name,
      kind: s.node.kind,
      health: s.health,
      progress: s.progress,
      elapsed: s.elapsed,
      daysQuiet: s.lastInTree ? daysBetween(s.lastInTree.ts, t.today) : null,
    }));
  const b: Brief = {
    today: t.today,
    week: t.week,
    overdue: withFlag('overdue'),
    dueSoon: withFlag('due-soon'),
    blocked: withFlag('blocked'),
    stale: withFlag('stale'),
    reviewStale: withFlag('review-stale'),
    claimed: withFlag('claimed'),
    behind,
    proposals: proposalFiles(reportsDir, t.week, events).filter((f) => f.status === 'pending'),
    empty: false,
  };
  b.empty = !b.overdue.length && !b.dueSoon.length && !b.blocked.length && !b.stale.length && !b.reviewStale.length && !b.claimed.length && !b.behind.length && !b.proposals.length;
  return b;
}

// ── candidates ─────────────────────────────────────────
export interface Candidate extends TaskFacts {
  weight: number;
  /** Nearest objective / metric / milestone above the task, with how far it lags its own timeline. */
  upper: { id: string; name: string; health: NodeState['health']; progress: number | null; elapsed: number | null; gap: number | null } | null;
  deps: { id: string; name: string; done: boolean }[];
  depsOpen: number;
  dependents: string[]; // tasks waiting on this one
  specMissing: string[];
}

export function specMissing(n: Node): string[] {
  const sp = n.spec ?? {};
  const m: string[] = [];
  if (!sp.goal) m.push('goal');
  if (!sp.accept?.length) m.push('accept');
  if (!sp.verify) m.push('verify');
  if (!sp.links?.length) m.push('links');
  return m;
}

/** Unfinished active tasks with the facts the skill ranks by: deadline, weight, the KR's gap, deps, carry-over. */
export function candidates(t: Tree, opts: { dispatchable?: boolean } = {}): Candidate[] {
  const dependents = new Map<string, string[]>();
  for (const s of t.all) for (const d of s.node.deps ?? []) dependents.set(d, [...(dependents.get(d) ?? []), s.node.id]);
  const prio = (p: Priority | null) => (p ? Number(p.slice(1)) : 9);
  return activeTasks(t)
    .filter((s) => s.stage !== 'done' && (!opts.dispatchable || s.dispatchable))
    .map((s) => {
      let up = s.parent;
      while (up && (up.node.kind === 'task' || up.node.kind === 'habit')) up = up.parent;
      const deps = (s.node.deps ?? []).map((d) => {
        const dep = t.byId.get(d);
        return { id: d, name: dep?.node.name ?? '?', done: !!dep && (dep.stage === 'done' || dep.effective === 'canceled') };
      });
      return {
        ...taskFacts(s, t.today),
        weight: s.node.weight ?? 1,
        upper: up
          ? { id: up.node.id, name: up.node.name, health: up.health, progress: up.progress, elapsed: up.elapsed, gap: up.progress !== null && up.elapsed !== null ? Math.round((up.progress - up.elapsed) * 100) / 100 : null }
          : null,
        deps,
        depsOpen: deps.filter((d) => !d.done).length,
        dependents: dependents.get(s.node.id) ?? [],
        specMissing: specMissing(s.node),
      };
    })
    .sort((a, b) => prio(a.priority) - prio(b.priority) || (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999') || a.id.localeCompare(b.id));
}

// ── changes / since ────────────────────────────────────
export interface Since {
  spec: string;
  since: string | null; // ISO instant; null means "everything"
  anchor: Event | null; // the report event used, when spec is last-daily / last-weekly
}

/** `--since last-daily | last-weekly | <date> | <ISO>`. A bare date starts at local midnight; no matching report means no lower bound. */
export function resolveSince(events: readonly Event[], spec: string): Since | null {
  if (spec === 'last-daily' || spec === 'last-weekly') {
    const kind = spec === 'last-daily' ? 'daily' : 'weekly';
    const anchor = [...sortEvents(events)].reverse().find((e) => e.type === 'report' && e.kind === kind) ?? null;
    return { spec, since: anchor ? (anchor.rec ?? anchor.ts) : null, anchor };
  }
  if (isValidDate(spec)) {
    const [y, m, d] = spec.split('-').map(Number);
    return { spec, since: nowIso(new Date(y, m - 1, d, 0, 0, 0)), anchor: null };
  }
  const ts = parseTs(spec);
  return ts ? { spec, since: ts, anchor: null } : null;
}

/** What was written after `since` (by `rec`, so back-dated entries still show up), minus report and plan events. Newest first. */
export function changes(events: readonly Event[], since: string | null): Event[] {
  const cut = since ? tsMs(since) : Number.NEGATIVE_INFINITY;
  return sortEvents(events.filter((e) => e.type !== 'report' && e.type !== 'plan' && tsMs(e.rec ?? e.ts) > cut)).reverse();
}

// ── commits ────────────────────────────────────────────
export interface RepoCommits {
  path: string;
  node: string | null;
  commits: { hash: string; author: string; date: string; subject: string }[];
  error?: string;
}

/** `git log` of every registered repo since an instant. Listing only; what it means for a KR is the agent's call. */
export function repoCommits(repos: readonly Repo[], since: string | null, limit = 200, run = gitLog): RepoCommits[] {
  return repos.map((r) => {
    const base = { path: r.path, node: r.node ?? null, commits: [] as RepoCommits['commits'] };
    if (!existsSync(r.path)) return { ...base, error: '目录不存在' };
    if (!existsSync(join(r.path, '.git'))) return { ...base, error: '不是 git 仓库' };
    try {
      const out = run(r.path, since, limit);
      base.commits = out
        .split('\n')
        .filter(Boolean)
        .map((l) => {
          const [hash, author, date, subject] = l.split('\x1f');
          return { hash, author, date, subject };
        });
      return base;
    } catch (err) {
      return { ...base, error: String((err as Error).message).split('\n')[0] };
    }
  });
}

function gitLog(path: string, since: string | null, limit: number): string {
  const args = ['-C', path, 'log', '--no-merges', `--max-count=${limit}`, '--format=%h\x1f%an\x1f%aI\x1f%s'];
  if (since) args.push(`--since=${since}`);
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

// ── apply ──────────────────────────────────────────────
export interface PlanNew extends Partial<Omit<Node, 'id' | 'name' | 'kind'>> {
  id?: string;
  name: string;
  kind?: NodeKind;
}

export interface PlanFile {
  week?: string;
  new?: PlanNew[];
  plan?: string[];
  drop?: string[];
}

export class PlanError extends Error {
  code: number;
  extra: Record<string, unknown>;
  constructor(msg: string, code = 1, extra: Record<string, unknown> = {}) {
    super(msg);
    this.code = code;
    this.extra = extra;
  }
}

export interface ApplyResult {
  week: string;
  nodes: Node[]; // the whole tree after
  created: Node[];
  planned: { id: string; order: number; before: { week: string | null; order: number | null } }[];
  kept: string[]; // already planned this week, not listed: untouched
  dropped: { id: string; before: string }[];
  warnings: string[];
  /** One change note per node touched, in the order they happened. */
  notes: { id: string; note: string }[];
}

const KINDS: NodeKind[] = ['objective', 'metric', 'milestone', 'task', 'habit'];
const PRIORITIES = ['P0', 'P1', 'P2', 'P3'];
const NEW_REF = /^new:(\d+)$/;

/**
 * Consume a plan.yaml (DESIGN §3). Pure: returns the new node list and what changed; the caller validates,
 * saves and writes events. Every carry-over task must be listed under `plan` or `drop` (code 3 otherwise).
 * Re-applying in the same week keeps unlisted planned tasks in place and appends the listed ones after them.
 */
export function applyPlan(nodes: readonly Node[], events: readonly Event[], t: Tree, file: PlanFile): ApplyResult {
  if (typeof file !== 'object' || file === null || Array.isArray(file)) throw new PlanError('plan.yaml 顶层要是一个映射');
  const week = file.week ?? t.week;
  if (!isValidWeek(week)) throw new PlanError(`week 格式：2026-W36，得到 "${week}"`);
  const warnings: string[] = [];
  if (week < t.week) warnings.push(`计划的周 ${week} 早于本周 ${t.week}`);
  for (const k of Object.keys(file)) if (!['week', 'new', 'plan', 'drop'].includes(k)) throw new PlanError(`plan.yaml 不认识的字段: ${k}`);
  const newList = file.new ?? [];
  const planList = file.plan ?? [];
  const dropList = file.drop ?? [];
  if (!Array.isArray(newList) || !Array.isArray(planList) || !Array.isArray(dropList)) throw new PlanError('new / plan / drop 都要是列表');
  if (!newList.length && !planList.length && !dropList.length) throw new PlanError('plan.yaml 里没有 new / plan / drop，没事可做');

  const all: Node[] = nodes.map((n) => ({ ...n }));
  const byId = new Map(all.map((n) => [n.id, n]));
  const notes: ApplyResult['notes'] = [];

  // 1. new nodes; ids first so new:N can point anywhere, including at later entries
  const created: Node[] = [];
  const newIds: string[] = [];
  newList.forEach((item, i) => {
    if (typeof item !== 'object' || item === null) throw new PlanError(`new[${i}] 要是一个映射`);
    if (!item.name || typeof item.name !== 'string') throw new PlanError(`new[${i}] 缺 name`);
    const kind = item.kind ?? 'task';
    if (!KINDS.includes(kind)) throw new PlanError(`new[${i}] kind 非法: ${kind}`);
    if (item.id !== undefined) {
      if (!/^[A-Za-z0-9][\w.-]*$/.test(item.id)) throw new PlanError(`new[${i}] id 只能用字母数字 . _ -：${item.id}`);
      if (byId.has(item.id) || newIds.includes(item.id)) throw new PlanError(`new[${i}] 节点 ${item.id} 已存在`);
      if (takenIds(all, events).has(item.id)) throw new PlanError(`new[${i}] ${item.id} 在事件历史或 deps 里出现过，id 不能复用`);
    }
    newIds.push(item.id ?? ''); // placeholder, filled after parent is known
  });
  const ref = (x: unknown, where: string): string => {
    if (typeof x !== 'string') throw new PlanError(`${where} 要是节点 id 或 new:N，得到 ${JSON.stringify(x)}`);
    const m = NEW_REF.exec(x);
    if (!m) return x;
    const i = Number(m[1]);
    if (i >= newList.length) throw new PlanError(`${where} 引用 ${x}，但 new 只有 ${newList.length} 项（下标从 0 起）`);
    return newIds[i];
  };
  newList.forEach((item, i) => {
    const kind = item.kind ?? 'task';
    const parentRef = item.parent ?? null;
    let parent: string | null = null;
    if (parentRef) {
      const m = NEW_REF.exec(parentRef);
      if (m && Number(m[1]) >= i) throw new PlanError(`new[${i}] 的 parent ${parentRef} 必须是排在它前面的 new 项`);
      parent = m ? newIds[Number(m[1])] : parentRef;
      if (!byId.has(parent)) throw new PlanError(`new[${i}] parent 不存在: ${parent}`);
    }
    const id = item.id || newId(all, kind, parent, events);
    newIds[i] = id;
    const node: Node = { id, name: item.name, kind };
    if (parent) node.parent = parent;
    const copy = <K extends keyof Node>(k: K) => {
      const v = item[k as keyof PlanNew] as Node[K] | undefined;
      if (v !== undefined && v !== null) node[k] = v;
    };
    for (const k of ['area', 'status', 'start', 'end', 'weight', 'unit', 'from', 'to', 'cadence', 'priority', 'deadline', 'order'] as const) copy(k);
    if (item.spec && typeof item.spec === 'object') node.spec = item.spec as Spec;
    if (item.deps) node.deps = (item.deps as unknown[]).map((d, j) => ref(d, `new[${i}].deps[${j}]`));
    if (node.priority && !PRIORITIES.includes(node.priority)) throw new PlanError(`new[${i}] priority 只能是 P0–P3`);
    if (node.deadline && !isValidDate(node.deadline)) throw new PlanError(`new[${i}] deadline 需要 YYYY-MM-DD`);
    if (kind === 'metric' && (typeof node.from !== 'number' || typeof node.to !== 'number')) throw new PlanError(`new[${i}] metric 需要 unit / from / to`);
    if (kind === 'habit' && !node.cadence) node.cadence = '1/week';
    if (kind !== 'task' && kind !== 'habit' && !node.start) node.start = t.today;
    if (kind !== 'task') for (const k of ['priority', 'deadline', 'deps', 'week', 'order', 'spec'] as const) if (k in node) throw new PlanError(`new[${i}] ${k} 只对 task 有意义`);
    all.push(node);
    byId.set(id, node);
    created.push(node);
  });
  for (const n of created) for (const d of n.deps ?? []) if (!byId.has(d)) throw new PlanError(`${n.id} 的依赖不存在: ${d}`);

  // 2. plan / drop lists
  const planIds = planList.map((x, i) => ref(x, `plan[${i}]`));
  const dropIds = dropList.map((x, i) => ref(x, `drop[${i}]`));
  const dupe = planIds.find((x, i) => planIds.indexOf(x) !== i);
  if (dupe) throw new PlanError(`plan 里 ${dupe} 出现了两次`);
  const both = planIds.filter((x) => dropIds.includes(x));
  if (both.length) throw new PlanError(`${both.join(', ')} 同时在 plan 和 drop 里`);
  const stateOf = (id: string) => t.byId.get(id);
  for (const id of planIds) {
    const n = byId.get(id);
    if (!n) throw new PlanError(`plan 里的节点不存在: ${id}`, 1, { candidates: [] });
    if (n.kind !== 'task') throw new PlanError(`${id} 是${n.kind}，只有 task 能排进周计划`, 3);
    const s = stateOf(id);
    if (s && s.stage === 'done') throw new PlanError(`${id} 已完成，不能排进 ${week}`, 3);
    if (s && s.effective !== 'active') throw new PlanError(`${id} 已${s.effective === 'canceled' ? '取消' : '冻结'}（自身或祖先），不能排进 ${week}`, 3);
    if (!s && created.some((c) => c.id === id) && (n.status ?? 'active') !== 'active') throw new PlanError(`${id} 状态不是 active，不能排进 ${week}`, 3);
  }
  for (const id of dropIds) {
    const n = byId.get(id);
    if (!n) throw new PlanError(`drop 里的节点不存在: ${id}`, 1, { candidates: [] });
    if (n.kind !== 'task') throw new PlanError(`drop 里的 ${id} 不是 task`, 3);
  }

  // 3. every carry-over relative to the target week must be decided
  const undecided = all
    .filter((n) => n.kind === 'task' && !!n.week && n.week! < week && !planIds.includes(n.id) && !dropIds.includes(n.id))
    .filter((n) => {
      const s = stateOf(n.id);
      return !s || (s.stage !== 'done' && s.effective === 'active');
    })
    .map((n) => n.id);
  if (undecided.length) throw new PlanError(`遗留任务要么进 plan 要么进 drop，未决定: ${undecided.join(', ')}`, 3, { carryOver: undecided });

  // 4. orders: unlisted tasks already in this week keep theirs, listed ones follow in list order
  const kept = all.filter((n) => n.kind === 'task' && n.week === week && !planIds.includes(n.id) && !dropIds.includes(n.id)).map((n) => n.id);
  let base = 0;
  for (const id of kept) {
    const o = byId.get(id)!.order;
    if (typeof o === 'number' && o > base) base = o;
  }
  const planned: ApplyResult['planned'] = [];
  planIds.forEach((id, i) => {
    const n = byId.get(id)!;
    const before = { week: n.week ?? null, order: typeof n.order === 'number' ? n.order : null };
    const order = base + i + 1;
    n.week = week;
    n.order = order;
    planned.push({ id, order, before });
    if (!created.some((c) => c.id === id)) {
      const diff = [before.week !== week ? `week: ${before.week ?? 'none'} → ${week}` : '', before.order !== order ? `order: ${before.order ?? 'none'} → ${order}` : ''].filter(Boolean).join('; ');
      if (diff) notes.push({ id, note: `edit ${id}: ${diff}` });
    }
    if (!specComplete(n)) warnings.push(`${id} spec 缺 ${specMissing(n).join('、')}，不可派工`);
  });
  const dropped: ApplyResult['dropped'] = [];
  for (const id of dropIds) {
    const n = byId.get(id)!;
    if (!n.week) {
      warnings.push(`${id} 本来就不在任何一周里，drop 没有效果`);
      continue;
    }
    dropped.push({ id, before: n.week });
    notes.push({ id, note: `edit ${id}: week: ${n.week} → none${typeof n.order === 'number' ? `; order: ${n.order} → none` : ''}` });
    delete n.week;
    delete n.order;
  }
  return { week, nodes: all, created, planned, kept, dropped, warnings, notes };
}

// ── report data ────────────────────────────────────────
export interface NodeDelta {
  id: string;
  name: string;
  kind: NodeKind;
  depth: number;
  parent: string | null;
  health: NodeState['health'];
  stage: Stage;
  progress: number | null;
  before: number | null; // as of the day before the week started
  delta: number | null;
  current: number | null; // metric value
  unit: string | null;
  assess: NodeState['assess'];
  events: number; // own events inside the week
}

export interface ReportData {
  week: string;
  start: string;
  end: string;
  today: string;
  current: boolean;
  nodes: NodeDelta[]; // pre-order, active subtree only
  done: { id: string; name: string; parent: string | null; ts: string; hours: number | null }[];
  events: Record<string, number>; // count by type inside the week
  velocity: ReturnType<typeof velocity>;
  plan: WeekView;
  brief: Brief;
  candidates: Candidate[];
  habits: { id: string; name: string; cadence: string; thisPeriod: number; times: number; streak: number; checksInWeek: number }[];
}

/** Everything the weekly report is written from: per-node progress delta over the week, what got done, the plan, the brief. */
export function reportData(t: Tree, events: readonly Event[], reportsDir: string, label = t.week): ReportData {
  const start = weekMonday(label)!;
  const end = addDays(start, 6);
  const before = addDays(start, -1);
  const inWeek = (ts: string) => dayOf(ts) >= start && dayOf(ts) <= end;
  const nodes: NodeDelta[] = t.all
    .filter((s) => s.effective === 'active')
    .map((s) => {
      const prev = progressAt(s, before);
      return {
        id: s.node.id,
        name: s.node.name,
        kind: s.node.kind,
        depth: s.depth,
        parent: s.node.parent ?? null,
        health: s.health,
        stage: s.stage,
        progress: s.progress,
        before: prev,
        delta: s.progress !== null && prev !== null ? Math.round((s.progress - prev) * 100) / 100 : null,
        current: s.current,
        unit: s.node.unit ?? null,
        assess: s.assess,
        events: s.events.filter((e) => inWeek(e.ts)).length,
      };
    });
  const done = t.all
    .filter((s) => s.node.kind === 'task' && s.stage === 'done')
    .flatMap((s) => {
      const d = [...s.events].reverse().find((e) => e.type === 'done');
      if (!d || !inWeek(d.ts)) return [];
      const hours = s.events.reduce<number | null>((acc, e) => (typeof e.hours === 'number' ? (acc ?? 0) + e.hours : acc), null);
      return [{ id: s.node.id, name: s.node.name, parent: s.node.parent ?? null, ts: d.ts, hours }];
    });
  const counts: Record<string, number> = {};
  for (const e of events) if (inWeek(e.ts)) counts[e.type] = (counts[e.type] ?? 0) + 1;
  const habits = t.all
    .filter((s) => s.node.kind === 'habit' && s.effective === 'active' && s.habit)
    .map((s) => ({
      id: s.node.id,
      name: s.node.name,
      cadence: s.node.cadence ?? '1/week',
      thisPeriod: s.habit!.thisPeriod,
      times: s.habit!.times,
      streak: s.habit!.streak,
      checksInWeek: [...s.habit!.days].filter((d) => d >= start && d <= end).length,
    }));
  return {
    week: label,
    start,
    end,
    today: t.today,
    current: label === t.week,
    nodes,
    done,
    events: counts,
    velocity: velocity(t, 4),
    plan: weekView(t, events, reportsDir, label),
    brief: brief(t, events, reportsDir),
    candidates: candidates(t),
    habits,
  };
}

export { basename as planFileName, weekLabel };
