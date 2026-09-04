import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bold, color, dim, GREEN, RED, STAGE_SYM } from './ansi.ts';
import { dayOf, daysBetween, isValidDate, isValidWeek, nowIso, parseTs, sortEvents, todayIso, tsMs } from './dates.ts';
import { DEMO_EVENTS, DEMO_NODES, DEMO_TODAY } from './demo.ts';
import { MigrateError, migrate } from './migrate.ts';
import { descendants, isAncestor, matchNode, newId, project, specComplete, takenIds, velocity } from './project.ts';
import type { Tree } from './project.ts';
import * as store from './store.ts';
import { installSkill, removeSkill, skillPaths } from './skill.ts';
import { runTui } from './tui.ts';
import { KIND_LABEL, STAGE_LABEL } from './types.ts';
import type { Event, EventType, Node, NodeKind, NodeState, Priority, Spec } from './types.ts';
import { mergeEventFiles, validateData, validateDir } from './validate.ts';
import type { MergeResult } from './validate.ts';
import { pct, rootIndex } from './views/common.ts';
import { renderDetail } from './views/detail.ts';
import { renderEvents } from './views/events.ts';
import { renderStatus } from './views/status.ts';
import { renderTree } from './views/tree.ts';

// ── argv ──────────────────────────────────────────────
type FlagVal = string | true | string[];
interface Args {
  _: string[];
  flags: Record<string, FlagVal>;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { _: [], flags: {} };
  const put = (k: string, v: string | true) => {
    const prev = a.flags[k];
    if (prev === undefined) a.flags[k] = v;
    else if (Array.isArray(prev)) prev.push(String(v));
    else a.flags[k] = [String(prev), String(v)];
  };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--') {
      a._.push(...argv.slice(i + 1));
      break;
    }
    if (t.startsWith('--')) {
      const [k, v] = t.slice(2).split(/=(.*)/s, 2);
      if (v !== undefined) put(k, v);
      else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) put(k, argv[++i]);
      else put(k, true);
    } else a._.push(t);
  }
  return a;
}

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0] ?? '';
const json = args.flags.json === true;
const demo = args.flags.demo === true;
const cols = process.stdout.columns || 100;

const PKG_VERSION: string = JSON.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8')).version;

const KNOWN_FLAGS = new Set([
  'json', 'demo', 'today', 'by', 'session', 'confirmed', 'force', 'at', 'link', 'hours', 'body', 'repo', 'commit',
  'value', 'node', 'days', 'weeks', 'all', 'spec', 'merge-events', 'kind', 'name', 'area', 'parent', 'start', 'end',
  'weight', 'status', 'metric', 'unit', 'from', 'to', 'cadence', 'habit', 'priority', 'deadline', 'dep', 'deps',
  'week', 'order', 'goal', 'accept', 'verify', 'reason', 'limit', 'help', 'version',
]);

const str = (k: string): string | undefined => {
  const v = args.flags[k];
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v[v.length - 1];
  return undefined;
};
const list = (k: string): string[] | undefined => {
  const v = args.flags[k];
  if (v === undefined || v === true) return undefined;
  return (Array.isArray(v) ? v : [v]).flatMap((x) => x.split(',')).map((x) => x.trim()).filter(Boolean);
};
const flag = (k: string): boolean => args.flags[k] === true;
const num = (k: string): number | undefined => {
  const v = str(k);
  if (v === undefined) return undefined;
  const n = Number(v);
  if (Number.isNaN(n)) fail(`--${k} 需要数字，得到 "${v}"`);
  return n;
};

// A bad --today is reported from dispatch(), where fail() is inside the top-level catch; until then fall back to the real day.
const todayFlag = str('today');
const today = todayFlag !== undefined && isValidDate(todayFlag) ? todayFlag : demo ? DEMO_TODAY : todayIso();
const by = str('by') ?? process.env.OKR_BY;
const session = str('session');
const confirmed = flag('confirmed');
const force = flag('force');

// ── output ────────────────────────────────────────────
/** Thrown by fail() instead of exiting directly, so a write in progress unwinds through its `finally` (lock release) before the process dies. */
class CliExit extends Error {
  code: number;
  constructor(code: number) {
    super(`exit ${code}`);
    this.code = code;
  }
}

function fail(msg: string, code = 1, extra: Record<string, unknown> = {}): never {
  if (json) console.log(JSON.stringify({ ok: false, error: msg, code, ...extra }));
  else console.error(color(RED, '✗ ') + msg);
  throw new CliExit(code);
}

function ok(data: Record<string, unknown>, human: () => void): void {
  if (json) console.log(JSON.stringify({ ok: true, ...data }, jsonReplacer));
  else human();
}

function jsonReplacer(_k: string, v: unknown): unknown {
  return v instanceof Set ? [...v] : v;
}

function load(): { nodes: Node[]; events: Event[] } {
  if (demo) return { nodes: DEMO_NODES, events: DEMO_EVENTS };
  return { nodes: store.loadNodes(), events: store.loadEvents() };
}

function requireData(): void {
  if (demo) return;
  if (store.hasOldLayout()) fail(`发现旧版 goals.yaml。先运行 ${bold('okr migrate')} 迁到新模型。`);
  if (!store.exists()) fail(`还没有初始化。先运行 ${bold('okr init')}，或者用 ${bold('okr tui --demo')} 看示例。`);
}

function buildTree(): Tree {
  requireData();
  const { nodes, events } = load();
  return project(nodes, events, today);
}

function pickNode(q: string | undefined, nodes: Node[], usage: string): Node {
  if (!q) fail(usage);
  const m = matchNode(nodes, q);
  if (m.node) return m.node;
  if (!m.candidates.length) fail(`没有匹配 "${q}" 的节点。okr tree 可以查看全部。`, 2, { candidates: [] });
  if (json) fail(`"${q}" 匹配到多个节点`, 2, { candidates: m.candidates.map((n) => ({ id: n.id, name: n.name, kind: n.kind })) });
  console.error(color(RED, '✗ ') + `"${q}" 匹配到多个节点，请指定 id：`);
  for (const n of m.candidates) console.error(`    ${bold(n.id)}  ${n.name}  ${dim(KIND_LABEL[n.kind])}`);
  throw new CliExit(2);
}

/** Every write: lock, reload inside the lock, run, commit. Never writes demo data. */
function write<T extends Record<string, unknown>>(fn: (nodes: Node[], events: Event[]) => { data: T; msg: string; human: () => void }): void {
  if (demo) fail('--demo 是只读的');
  if (str('today') !== undefined) fail('--today 只影响读，写入命令不接受', 1);
  requireData();
  // Event arguments are checked before the lock so a bad --at / --hours cannot fail after nodes.yaml is already on disk.
  eventTs();
  num('hours');
  try {
    store.withLock(() => {
      const { data, msg, human } = fn(store.loadNodes(), store.loadEvents());
      const c = store.commit(msg);
      if (!c.committed) console.error(color(RED, '! ') + `git commit 失败（文件已写入）: ${c.error ?? ''}`);
      ok({ ...data, committed: c.committed }, human);
    });
  } catch (err) {
    if (err instanceof store.LockTimeout) fail(err.message, 4);
    throw err;
  }
}

function eventTs(): { ts: string; rec: string } {
  const rec = nowIso();
  const at = str('at');
  if (at === undefined) return { ts: rec, rec };
  let ts = parseTs(at);
  if (!ts) fail(`--at 需要日期或 ISO 时间，得到 "${at}"`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(at)) {
    // a bare date means "that day": today is now, an earlier day is noon there, a later day is the future
    if (at > dayOf(rec)) fail(`--at 不能是未来时间: ${at}`);
    if (at === dayOf(rec)) ts = rec;
  } else if (tsMs(ts) - tsMs(rec) > 5 * 60 * 1000) fail(`--at 不能是未来时间: ${at}`);
  return { ts, rec };
}

function mkEvent(node: string | null, type: EventType, note: string, extra: Partial<Event> = {}): Event {
  const e: Event = { ...eventTs(), node, type, note };
  if (by) e.by = by;
  if (session) e.session = session;
  if (type !== 'change') {
    const links = list('link');
    if (links?.length) e.links = links;
  }
  const hours = num('hours');
  if (hours !== undefined) e.hours = hours;
  const body = str('body');
  if (body) e.body = body;
  const repo = str('repo');
  if (repo) e.repo = repo;
  const commit = str('commit');
  if (commit) e.commit = commit;
  if (confirmed) e.confirmed = true;
  Object.assign(e, extra);
  return e;
}

function state(nodes: Node[], events: Event[], id: string): NodeState {
  return project(nodes, events, today).byId.get(id)!;
}

// ── guards ────────────────────────────────────────────
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** Same node, same day, same type as the node's previous event, and the text is the same: refuse. */
function dedupGuard(events: Event[], e: Event): void {
  if (force || !e.node) return;
  const own = sortEvents(events.filter((x) => x.node === e.node));
  if (e.type === 'check') {
    const same = own.find((x) => x.type === 'check' && dayOf(x.ts) === dayOf(e.ts));
    if (same) fail(`${dayOf(same.ts)} 已经打过卡。确认要再记一次就加 --force。`, 3, { duplicate: same });
    return;
  }
  const prev = own[own.length - 1];
  if (!prev || prev.type !== e.type || dayOf(prev.ts) !== dayOf(e.ts)) return;
  if (prev.value !== e.value) return;
  if ((prev.links ?? []).join('\n') !== (e.links ?? []).join('\n')) return;
  const a = norm(prev.note);
  const b = norm(e.note);
  if (a === b || (a.length > 6 && b.includes(a)) || (b.length > 6 && a.includes(b)))
    fail(`与 ${dayOf(prev.ts)} 的上一条 ${e.type} 内容相近："${prev.note}"。确认不是重复就加 --force。`, 3, { duplicate: prev });
}

function appendStageEvent(type: EventType, usage: string, opts: { noteRequired?: boolean; defaultNote?: string } = {}): void {
  write((nodes, events) => {
    const n = pickNode(args._[1], nodes, usage);
    const note = args._.slice(2).join(' ') || opts.defaultNote || '';
    if (opts.noteRequired && !note) fail(usage);
    const s = state(nodes, events, n.id);
    const e = mkEvent(n.id, type, note);
    const value = num('value');
    if (value !== undefined) e.value = value;
    guardStage(type, n, s, e);
    dedupGuard(events, e);
    store.appendEvent(e);
    const after = state(nodes, [...events, e], n.id);
    return {
      data: { event: e, node: n.id, stage: after.stage, progress: after.progress },
      msg: `${type} ${n.id}: ${note}`.trim(),
      human: () => {
        if (n.kind === 'habit' && after.habit) {
          const h = after.habit;
          console.log(`${color(GREEN, '✓')} ${bold(n.id)} ${n.name}  本周期 ${h.thisPeriod}/${h.times}  连续 ${h.streak}  累计 ${h.total}`);
          return;
        }
        const st = STAGE_SYM[after.stage];
        console.log(`${color(GREEN, '✓')} ${bold(n.id)} ${n.name}  ${color(st.c, `${st.sym} ${STAGE_LABEL[after.stage]}`)}${after.progress !== null ? dim(`  进度 ${pct(after.progress)}`) : ''}`);
      },
    };
  });
}

/** Own status or the nearest canceled / frozen ancestor. --force overrides. */
/**
 * Validate the tree after a structural write and reject only the errors this write introduces.
 * Pre-existing problems (say, a stale line in events.jsonl) are echoed as warnings so one bad record
 * does not freeze every later add / edit; `okr validate` is where they get fixed.
 */
function guardValidate(before: Node[], after: Node[], events: Event[]): { warnings: string[] } {
  const v = validateData(after, events);
  if (!v.errors.length) return { warnings: v.warnings };
  const old = new Set(validateData(before, events).errors);
  const fresh = v.errors.filter((x) => !old.has(x));
  if (fresh.length) fail(fresh.join('\n'), 3, { errors: fresh });
  const carried = v.errors.map((x) => `已有问题（本次未引入，okr validate 处理）: ${x}`);
  if (!json) for (const w of carried) console.error(color(214, '! ') + w);
  return { warnings: [...v.warnings, ...carried] };
}

function guardActive(n: Node, s: NodeState): void {
  if (s.effective === 'active' || force) return;
  fail(`${n.id} ${s.effective === 'canceled' ? '已取消' : '已冻结'}（自身或祖先），要写入就加 --force`, 3);
}

function guardStage(type: EventType, n: Node, s: NodeState, e: Event): void {
  const upper = n.kind === 'objective' || n.kind === 'metric' || n.kind === 'milestone';
  guardActive(n, s);
  switch (type) {
    case 'done':
      if (n.kind === 'habit') fail(`习惯没有完成，不再做就 okr edit ${n.id} --status canceled --confirmed`, 3);
      if (upper && !confirmed) fail(`${KIND_LABEL[n.kind]} ${n.id} 的完成要问用户，确认后加 --confirmed`, 3);
      if (s.stage === 'done') fail(`${n.id} 已经是完成状态`, 3);
      break;
    case 'claim':
      if (n.kind !== 'task') fail('只能领取 task', 3);
      if (!e.by) fail('claim 需要 --by（或环境变量 OKR_BY）', 3);
      if (s.stage === 'done') fail(`${n.id} 已完成，不能领取`, 3);
      if (s.claimed && !force) {
        const same = s.claimed.by === e.by && (!s.claimed.session || !e.session || s.claimed.session === e.session);
        if (!same) fail(`${n.id} 已被 ${s.claimed.by}${s.claimed.session ? ` (${s.claimed.session})` : ''} 于 ${dayOf(s.claimed.ts)} 领取且未 submit。要抢就加 --force。`, 3, { claimed: s.claimed });
      }
      break;
    case 'submit':
      if (n.kind !== 'task') fail('只能给 task submit', 3);
      if (!e.links?.length) fail('submit 必须带 --link <PR>', 3);
      if (s.stage === 'done') fail(`${n.id} 已完成`, 3);
      break;
    case 'reject': {
      const hasSubmit = s.events.some((x) => x.type === 'submit');
      if (!hasSubmit && s.stage !== 'done') fail(`${n.id} 没有 submit 也不是完成状态，没有可打回的东西`, 3);
      if (s.stage === 'done' && n.kind !== 'task' && !confirmed) fail(`重新打开 ${KIND_LABEL[n.kind]} ${n.id} 要 --confirmed`, 3);
      if (!e.note) fail('reject 要带意见', 3);
      break;
    }
    case 'progress':
      if (n.kind === 'habit') fail(`${n.id} 是习惯，用 okr check`, 3);
      if (e.value !== undefined && n.kind !== 'metric') fail(`--value 只对 metric 有意义`, 3);
      break;
    case 'check':
      if (n.kind !== 'habit') fail(`${n.id} 不是习惯，用 okr log`, 3);
      break;
    case 'blocked':
      if (n.kind !== 'task' && n.kind !== 'milestone') fail('block 只对 task / milestone 有意义', 3);
      if (s.stage === 'done') fail(`${n.id} 已完成`, 3);
      if (!e.note) fail('block 要说明卡在哪', 3);
      break;
  }
}

// ── node fields from flags ────────────────────────────
const KINDS: NodeKind[] = ['objective', 'metric', 'milestone', 'task', 'habit'];
const PRIORITIES: Priority[] = ['P0', 'P1', 'P2', 'P3'];

/** Flags → partial node. `present` lists keys the caller passed, so edit can clear with --key none. */
function nodeFields(kind: NodeKind): { patch: Partial<Node>; present: string[] } {
  const patch: Partial<Node> = {};
  const present: string[] = [];
  const take = <K extends keyof Node>(k: K, v: Node[K] | undefined, given = v !== undefined) => {
    if (!given) return;
    present.push(k);
    patch[k] = v;
  };
  const clearable = (k: string) => (str(k) === 'none' ? null : str(k));
  take('name', str('name'));
  take('area', clearable('area') ?? undefined, str('area') !== undefined);
  take('parent', clearable('parent'), str('parent') !== undefined);
  take('start', str('start'));
  take('end', clearable('end'), str('end') !== undefined);
  take('weight', num('weight'));
  const status = str('status');
  if (status !== undefined) {
    if (!['active', 'canceled', 'frozen'].includes(status)) fail('--status 只能是 active / canceled / frozen');
    take('status', status as Node['status']);
  }
  const metric = str('metric');
  if (metric) {
    const [unit, from, to] = metric.split(':');
    if (from === undefined || to === undefined || Number.isNaN(+from) || Number.isNaN(+to)) fail('--metric 格式：单位:起点:目标，例如 %:76:95');
    take('unit', unit);
    take('from', +from);
    take('to', +to);
  }
  take('unit', str('unit'));
  take('from', num('from'));
  take('to', num('to'));
  take('cadence', str('cadence') ?? str('habit'));
  const priority = str('priority');
  if (priority !== undefined) {
    if (!PRIORITIES.includes(priority as Priority)) fail('--priority 只能是 P0–P3');
    take('priority', priority as Priority);
  }
  take('deadline', clearable('deadline') ?? undefined, str('deadline') !== undefined);
  const deps = list('dep') ?? list('deps');
  if (deps) take('deps', deps.filter((d) => d !== 'none'));
  const week = str('week');
  if (week !== undefined) {
    if (week !== 'none' && !isValidWeek(week)) fail('--week 格式：2026-W36');
    take('week', week === 'none' ? undefined : week, true);
  }
  take('order', num('order'));
  const spec: Spec = {};
  let hasSpec = false;
  if (str('goal') !== undefined) (spec.goal = str('goal')), (hasSpec = true);
  if (list('accept')) (spec.accept = list('accept')), (hasSpec = true);
  if (str('verify') !== undefined) (spec.verify = str('verify')), (hasSpec = true);
  if (list('link')) (spec.links = list('link')), (hasSpec = true);
  if (hasSpec) take('spec', spec);
  for (const k of ['start', 'end', 'deadline'] as const) {
    const v = patch[k];
    if (typeof v === 'string' && !isValidDate(v)) fail(`--${k} 需要 YYYY-MM-DD，得到 "${v}"`);
  }
  if (kind !== 'task') for (const k of ['priority', 'deadline', 'deps', 'week', 'order', 'spec'] as const) if (k in patch) fail(`--${k} 只对 task 有意义`);
  return { patch, present };
}

function describe(n: Node): string {
  const bits = [KIND_LABEL[n.kind], n.parent ? `父 ${n.parent}` : '', n.area ?? ''].filter(Boolean);
  return `${n.id} ${n.name}（${bits.join('，')}）`;
}

function diffNodes(a: Node, b: Node): string {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out: string[] = [];
  for (const k of keys) {
    const x = JSON.stringify((a as unknown as Record<string, unknown>)[k] ?? null);
    const y = JSON.stringify((b as unknown as Record<string, unknown>)[k] ?? null);
    if (x !== y) out.push(`${k}: ${x} → ${y}`);
  }
  return out.join('; ');
}

// ── commands: structure ───────────────────────────────
function cmdInit(): void {
  if (store.hasOldLayout()) fail(`发现旧版 goals.yaml。用 ${bold('okr migrate')} 迁移，不要 init。`);
  const { created } = store.init();
  ok({ dir: store.DIR, created }, () => console.log(created ? `${color(GREEN, '✓')} 已在 ${store.DIR} 初始化。下一步 ${bold('okr add')} 建目标。` : `${store.DIR} 已经存在。`));
}

const ADD_USAGE =
  '用法: okr add [id] --name 名称 --kind objective|metric|milestone|task|habit [--parent id] [--area 领域] [--start 日期 --end 日期] [--weight N] [--status active|frozen|canceled] [--metric 单位:起点:目标] [--cadence 3/week] [--priority P1] [--deadline 日期] [--dep id] [--week 2026-W36] [--goal … --accept … --verify … --link …] --confirmed';

function cmdAdd(): void {
  write((nodes, events) => {
    const kind = (str('kind') ??
      (str('metric') || str('from') !== undefined || str('to') !== undefined
        ? 'metric'
        : str('cadence') ?? str('habit')
          ? 'habit'
          : undefined)) as NodeKind | undefined;
    if (!kind || !KINDS.includes(kind)) fail(ADD_USAGE + '（无法从其它参数推出 kind 时必须显式 --kind）');
    if (!str('name')) fail(ADD_USAGE);
    if (!confirmed) fail('结构变更要 --confirmed（skill 在用户点头后传）', 3);
    const { patch } = nodeFields(kind);
    const parent = patch.parent ?? null;
    if (parent && !nodes.some((n) => n.id === parent)) fail(`parent 不存在: ${parent}`);
    const id = args._[1] ?? newId(nodes, kind, parent, events);
    if (!/^[A-Za-z0-9][\w.-]*$/.test(id)) fail(`id 只能用字母数字 . _ -：${id}`);
    if (nodes.some((n) => n.id === id)) fail(`节点 ${id} 已存在`);
    if (takenIds(nodes, events).has(id)) fail(`${id} 在事件历史或 deps 里出现过，id 不能复用，换一个或不指定让 okr 生成`);
    const node: Node = { id, name: patch.name!, kind, ...patch };
    if (parent) node.parent = parent;
    else delete node.parent;
    if (kind === 'metric' && (typeof node.from !== 'number' || typeof node.to !== 'number')) fail('metric 需要 --metric 单位:起点:目标');
    if (kind === 'habit' && !node.cadence) node.cadence = '1/week';
    if (kind !== 'task' && kind !== 'habit' && !node.start) node.start = today;
    for (const d of node.deps ?? []) if (!nodes.some((n) => n.id === d)) fail(`依赖不存在: ${d}`);
    const all = [...nodes, node];
    const v = guardValidate(nodes, all, events);
    const ownWarnings = v.warnings.filter((w) => w.startsWith(`节点 ${id} `));
    store.saveNodes(all);
    const e = mkEvent(id, 'change', `add ${describe(node)}`);
    store.appendEvent(e);
    return {
      data: { node, event: e, warnings: ownWarnings },
      msg: `add ${id}: ${node.name}`,
      human: () => {
        console.log(`${color(GREEN, '✓')} 新建 ${bold(id)} ${node.name}  ${dim(KIND_LABEL[kind] + (parent ? ` · 父 ${parent}` : ''))}`);
        if (kind === 'task' && !specComplete(node)) console.log(dim('  spec 不全，不可派工。okr edit ' + id + ' --goal … --accept … --verify … --link …'));
        for (const w of ownWarnings) console.log(dim('  ! ' + w));
      },
    };
  });
}

function cmdEdit(): void {
  write((nodes, events) => {
    const n = pickNode(args._[1], nodes, '用法: okr edit <id> [--name …] [--status active|canceled|frozen] [--priority …] [--deadline …|none] [--dep …] [--week …|none] [--goal … --accept … --verify … --link …] …');
    const { patch, present } = nodeFields(n.kind);
    if (present.includes('parent')) fail('改父节点用 okr move', 3);
    if (!present.length) fail('没有要改的字段');
    const before = { ...n };
    const next: Node = { ...n };
    for (const k of present) {
      const v = (patch as Record<string, unknown>)[k];
      if (k === 'spec') next.spec = { ...(n.spec ?? {}), ...(v as Spec) };
      else if (v === undefined || v === null) delete (next as unknown as Record<string, unknown>)[k];
      else (next as unknown as Record<string, unknown>)[k] = v;
    }
    if (present.includes('end') && patch.end === null) next.end = null;
    const all = nodes.map((x) => (x.id === n.id ? next : x));
    const v = guardValidate(nodes, all, events);
    const ownWarnings = v.warnings.filter((w) => w.startsWith(`节点 ${n.id} `));
    const diff = diffNodes(before, next);
    if (!diff) fail('没有变化');
    store.saveNodes(all);
    const e = mkEvent(n.id, 'change', `edit ${n.id}: ${diff}`);
    store.appendEvent(e);
    return {
      data: { node: next, event: e, warnings: ownWarnings },
      msg: `edit ${n.id}: ${diff}`,
      human: () => {
        console.log(`${color(GREEN, '✓')} ${bold(n.id)} ${diff}`);
        for (const w of ownWarnings) console.log(dim('  ! ' + w));
      },
    };
  });
}

function cmdMove(): void {
  write((nodes, events) => {
    const n = pickNode(args._[1], nodes, '用法: okr move <id> --to <parent|none> --confirmed');
    const to = str('to');
    if (!to) fail('用法: okr move <id> --to <parent|none> --confirmed');
    if (!confirmed) fail('结构变更要 --confirmed', 3);
    const parent = to === 'none' ? null : pickNode(to, nodes, '').id;
    if (parent === n.id) fail('不能挂到自己下面', 3);
    const t = project(nodes, events, today);
    if (parent && isAncestor(t, n.id, parent)) fail(`${parent} 在 ${n.id} 的子树里，会成环`, 3);
    if ((n.parent ?? null) === parent) fail('已经在那里了');
    const next: Node = { ...n };
    if (parent) next.parent = parent;
    else delete next.parent;
    const all = nodes.map((x) => (x.id === n.id ? next : x));
    store.saveNodes(all);
    const note = `move ${n.id}: parent ${n.parent ?? 'none'} → ${parent ?? 'none'}`;
    const e = mkEvent(n.id, 'change', note);
    store.appendEvent(e);
    return { data: { node: next, event: e }, msg: note, human: () => console.log(`${color(GREEN, '✓')} ${note}`) };
  });
}

function cmdRm(): void {
  write((nodes, events) => {
    const n = pickNode(args._[1], nodes, '用法: okr rm <id> --confirmed');
    if (!confirmed) fail('结构变更要 --confirmed', 3);
    if (nodes.some((x) => x.parent === n.id)) fail(`${n.id} 有子节点，不能删。用 edit --status canceled`, 3);
    if (events.some((x) => x.node === n.id && x.type !== 'change')) fail(`${n.id} 有事件，不能删。用 edit --status canceled`, 3);
    const dependents = nodes.filter((x) => x.deps?.includes(n.id)).map((x) => x.id);
    if (dependents.length) fail(`${dependents.join(', ')} 依赖 ${n.id}，先改它们的 deps`, 3);
    store.saveNodes(nodes.filter((x) => x.id !== n.id));
    const note = `rm ${describe(n)}`;
    const e = mkEvent(n.id, 'change', note);
    store.appendEvent(e);
    return { data: { node: n, event: e }, msg: note, human: () => console.log(`${color(GREEN, '✓')} 已删除 ${bold(n.id)} ${n.name}`) };
  });
}

function cmdRepo(): void {
  const sub = args._[1];
  if (sub === 'list' || !sub) {
    requireData();
    const repos = store.loadRepos();
    ok({ repos }, () => {
      if (!repos.length) console.log(dim('没有登记仓库。okr repo add <path> [--node id]'));
      for (const r of repos) console.log(` ${r.path}${r.node ? dim(`  → ${r.node}`) : ''}`);
    });
    return;
  }
  if (sub !== 'add' && sub !== 'rm') fail('用法: okr repo add <path> [--node id] | okr repo rm <path> | okr repo list');
  write<Record<string, unknown>>((nodes) => {
    const path = resolve(args._[2] ?? '.');
    const repos = store.loadRepos();
    if (sub === 'rm') {
      if (!repos.some((r) => r.path === path)) fail(`没有登记 ${path}`);
      store.saveRepos(repos.filter((r) => r.path !== path));
      return { data: { path }, msg: `repo rm ${path}`, human: () => console.log(`${color(GREEN, '✓')} 已移除 ${path}`) };
    }
    if (!existsSync(path) || !statSync(path).isDirectory()) fail(`目录不存在: ${path}`);
    const warnings: string[] = [];
    if (!existsSync(resolve(path, '.git'))) warnings.push('目录里没有 .git，提交提取（okr commits，待实现）会跳过它');
    const node = str('node');
    if (node && !nodes.some((n) => n.id === node)) fail(`节点不存在: ${node}`);
    const next = repos.filter((r) => r.path !== path);
    next.push(node ? { path, node } : { path });
    store.saveRepos(next);
    return {
      data: { repo: { path, node }, warnings },
      msg: `repo add ${path}`,
      human: () => {
        console.log(`${color(GREEN, '✓')} 已登记 ${path}${node ? dim(` → ${node}`) : ''}`);
        for (const w of warnings) console.log(dim('  ! ' + w));
      },
    };
  });
}

function cmdValidate(): void {
  if (demo) {
    const r = validateData(DEMO_NODES, DEMO_EVENTS);
    printReport(r);
    return;
  }
  requireData();
  let merged: MergeResult[] = [];
  if (flag('merge-events')) {
    try {
      store.withLock(() => {
        merged = mergeEventFiles();
        const done = merged.filter((m) => !m.errors.length);
        if (done.length) store.commit(`validate --merge-events: 并入 ${done.length} 个文件`);
      });
    } catch (err) {
      if (err instanceof store.LockTimeout) fail(err.message, 4);
      throw err;
    }
  }
  const dir = validateDir();
  let data: { errors: string[]; warnings: string[] };
  try {
    data = validateData(store.loadNodes(), store.loadEvents());
  } catch (err) {
    // the directory report already names the bad line; keep it instead of dying on the parse error
    data = { errors: [`读取数据失败: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`], warnings: [] };
  }
  const mergeErrors = merged.flatMap((m) => m.errors);
  printReport({ errors: [...mergeErrors, ...dir.errors, ...data.errors], warnings: [...dir.warnings, ...data.warnings], merged });
}

function printReport(r: { errors: string[]; warnings: string[]; merged?: MergeResult[] }): void {
  const code = r.errors.length ? 3 : 0;
  if (json) console.log(JSON.stringify({ ok: !r.errors.length, ...r }));
  else {
    for (const m of r.merged ?? []) {
      if (m.errors.length) console.log(`${color(RED, '✗')} 未并入 ${m.file}（文件保留）`);
      else console.log(`${color(GREEN, '✓')} 并入 ${m.file}：新增 ${m.added}，重复 ${m.skipped}`);
    }
    for (const e of r.errors) console.log(color(RED, '✗ ') + e);
    for (const w of r.warnings) console.log(color(214, '! ') + w);
    if (!r.errors.length) console.log(`${color(GREEN, '✓')} 数据正常${r.warnings.length ? dim(`（${r.warnings.length} 条提示）`) : ''}`);
  }
  if (code) throw new CliExit(code);
}

function cmdMigrate(): void {
  if (demo) fail('--demo 是只读的');
  try {
    store.withLock(() => {
      const r = migrate();
      const c = store.commit('migrate: goals.yaml → nodes.yaml');
      ok({ nodes: r.nodes.length, events: r.events.length, warnings: r.warnings, committed: c.committed }, () => {
        console.log(`${color(GREEN, '✓')} 迁移完成：${r.nodes.length} 节点，${r.events.length} 事件。旧文件保留为 *.migrated。`);
        for (const w of r.warnings) console.log(dim('  ! ' + w));
      });
    });
  } catch (err) {
    if (err instanceof store.LockTimeout) fail(err.message, 4);
    if (err instanceof MigrateError) fail(err.message, 3, { errors: err.errors });
    fail((err as Error).message);
  }
}

// ── commands: record ──────────────────────────────────
function cmdAssess(): void {
  write((nodes, events) => {
    const n = pickNode(args._[1], nodes, '用法: okr assess <id> --value <0-100> --reason "理由"');
    const value = num('value');
    const reason = str('reason') ?? args._.slice(2).join(' ');
    if (value === undefined) fail('assess 需要 --value 百分比', 3);
    if (!reason) fail('assess 需要 --reason 理由，引用具体任务和 KR 状态', 3);
    if (n.kind === 'metric') fail('metric 的进度只来自用户口述的 value，不接受 assess', 3);
    if (n.kind !== 'objective' && n.kind !== 'milestone') fail('assess 只对 objective / milestone', 3);
    if (value < 0 || value > 100) fail('--value 要在 0–100', 3);
    const s = state(nodes, events, n.id);
    guardActive(n, s);
    const e = mkEvent(n.id, 'assess', reason, { value, derived: s.derived === null ? undefined : Math.round(s.derived * 100) });
    dedupGuard(events, e);
    store.appendEvent(e);
    return {
      data: { event: e, node: n.id, derived: s.derived },
      msg: `assess ${n.id}: ${value}%`,
      human: () => console.log(`${color(GREEN, '✓')} ${bold(n.id)} 评估 ${value}%${dim(`  推导 ${pct(s.derived)}`)}`),
    };
  });
}

function cmdRecent(): void {
  const t = buildTree();
  const days = num('days') ?? 7;
  const node = str('node');
  const since = daysBetween;
  let events = t.all.flatMap((s) => s.events);
  const { events: raw } = load();
  events = [...events, ...raw.filter((e) => !e.node)];
  events = events.filter((e) => since(e.ts, today) <= days && since(e.ts, today) >= 0);
  if (node) {
    const n = pickNode(node, t.all.map((s) => s.node), '');
    const s = t.byId.get(n.id)!;
    const ids = new Set([n.id, ...descendants(s).map((x) => x.node.id)]);
    events = events.filter((e) => e.node && ids.has(e.node));
  }
  events = sortEvents(events).reverse();
  ok({ events, days, today }, () => console.log(renderEvents(t, { width: cols, events }).join('\n')));
}

function cmdVelocity(): void {
  const t = buildTree();
  const v = velocity(t, num('weeks') ?? 4);
  ok({ weeks: v }, () => {
    console.log(dim(' 周          完成  用时'));
    for (const w of v) console.log(` ${w.week}   ${String(w.done).padStart(4)}  ${w.hours === null ? dim('—') : `${w.hours}h`}  ${dim(w.ids.join(' '))}`);
  });
}

// ── commands: views ───────────────────────────────────
function nodeJson(s: NodeState): Record<string, unknown> {
  const task = s.node.kind === 'task';
  return {
    ...s.node,
    derived: s.derived,
    assess: s.assess,
    progress: s.progress,
    current: s.current,
    elapsed: s.elapsed,
    health: s.health,
    flags: s.flags,
    undecomposed: s.undecomposed,
    last: s.last?.ts ?? null,
    lastInTree: s.lastInTree?.ts ?? null,
    habit: s.habit ? { ...s.habit, days: [...s.habit.days] } : undefined,
    children: s.children.map((c) => c.node.id),
    ...(task ? { stage: s.stage, planned: s.planned, carryOver: s.carryOver, dispatchable: s.dispatchable, claimed: s.claimed, blocked: s.blocked } : {}),
  };
}

function cmdStatus(): void {
  const t = buildTree();
  ok({ today, week: t.week, nodes: t.roots.map(nodeJson) }, () => console.log(renderStatus(t, { width: cols }).join('\n')));
}

function cmdTree(): void {
  const t = buildTree();
  ok({ today, week: t.week, nodes: t.all.map(nodeJson) }, () => console.log(renderTree(t, { width: cols, showDone: flag('all') }).lines.join('\n')));
}

function cmdShow(): void {
  const t = buildTree();
  const n = pickNode(args._[1], t.all.map((s) => s.node), '用法: okr show <id> [--spec]');
  const s = t.byId.get(n.id)!;
  if (flag('spec')) return showSpec(t, s);
  ok({ node: nodeJson(s), events: s.events }, () => console.log(renderDetail(s, { width: cols, today, colorIdx: rootIndex(t, s), maxEvents: num('limit') ?? 12, tree: t }).join('\n')));
}

/** The dispatch package: everything an executing agent needs, including the write-back commands. */
function showSpec(t: Tree, s: NodeState): void {
  const n = s.node;
  if (n.kind !== 'task') fail(`${n.id} 不是 task，没有派工包`);
  const sp = n.spec ?? {};
  const deps = (n.deps ?? []).map((d) => {
    const dep = t.byId.get(d);
    return { id: d, name: dep?.node.name ?? '?', done: !!dep && (dep.stage === 'done' || dep.effective === 'canceled') };
  });
  const submits = s.events.filter((e) => e.type === 'submit').map((e) => ({ ts: e.ts, by: e.by, links: e.links ?? [] }));
  const rejects = s.events.filter((e) => e.type === 'reject').map((e) => ({ ts: e.ts, by: e.by, note: e.note, body: e.body }));
  const agent = by ?? '<agent>';
  const sess = session ?? '<session>';
  const commands = [
    `okr claim ${n.id} --by ${agent} --session ${sess} --json`,
    `okr block ${n.id} "卡在哪" --by ${agent} --session ${sess} --json`,
    `okr log ${n.id} "解除阻塞 / 关键进展" --by ${agent} --session ${sess} --json`,
    `okr submit ${n.id} --link <PR> --by ${agent} --session ${sess} --json`,
  ];
  const pathIds: string[] = [];
  let p = s.parent;
  while (p) {
    pathIds.unshift(`${p.node.id} ${p.node.name}`);
    p = p.parent;
  }
  ok(
    { id: n.id, name: n.name, path: pathIds, stage: s.stage, dispatchable: s.dispatchable, spec: sp, missing: specMissing(n), deps, claimed: s.claimed, submits, rejects, commands },
    () => {
      const L: string[] = [];
      L.push(`# 任务 ${n.id}：${n.name}`);
      if (pathIds.length) L.push(`所属：${pathIds.join(' › ')}`);
      L.push(`阶段：${STAGE_LABEL[s.stage]}${n.priority ? `  优先级：${n.priority}` : ''}${n.deadline ? `  截止：${n.deadline}` : ''}`);
      if (s.claimed) L.push(`已领取：${s.claimed.by}${s.claimed.session ? ` (${s.claimed.session})` : ''} @ ${s.claimed.ts}`);
      L.push('');
      L.push(`## 目标`, sp.goal ?? '（缺）', '');
      L.push('## 验收标准');
      if (sp.accept?.length) sp.accept.forEach((a, i) => L.push(`${i + 1}. ${a}`));
      else L.push('（缺）');
      L.push('', '## 验证命令', sp.verify ? '```\n' + sp.verify + '\n```' : '（缺）', '');
      L.push('## 链接');
      if (sp.links?.length) for (const l of sp.links) L.push(`- ${l}`);
      else L.push('（缺）');
      if (deps.length) {
        L.push('', '## 依赖');
        for (const d of deps) L.push(`- ${d.done ? '[x]' : '[ ]'} ${d.id} ${d.name}`);
      }
      if (submits.length) {
        L.push('', '## 历史提交');
        for (const x of submits) L.push(`- ${dayOf(x.ts)} ${x.by ?? ''} ${x.links.join(' ')}`);
      }
      if (rejects.length) {
        L.push('', '## 打回意见');
        for (const x of rejects) L.push(`- ${dayOf(x.ts)}：${x.note}${x.body ? '\n  ' + x.body.replace(/\n/g, '\n  ') : ''}`);
      }
      if (s.dispatchable) L.push('', '> 可派工');
      if (!s.dispatchable) L.push('', `> 不可派工：${specMissing(n).length ? 'spec 缺 ' + specMissing(n).join('、') : deps.some((d) => !d.done) ? '依赖未完成' : s.stage === 'done' ? '已完成' : '状态非 active'}`);
      L.push('', '## 回写命令（照抄）', '```');
      L.push(...commands);
      L.push('```');
      console.log(L.join('\n'));
    },
  );
}

function specMissing(n: Node): string[] {
  const sp = n.spec ?? {};
  const m: string[] = [];
  if (!sp.goal) m.push('goal');
  if (!sp.accept?.length) m.push('accept');
  if (!sp.verify) m.push('verify');
  if (!sp.links?.length) m.push('links');
  return m;
}

function cmdTui(): void {
  requireData();
  if (!process.stdout.isTTY || !process.stdin.isTTY) fail('tui 需要终端。非交互环境用 okr status / okr tree。');
  void runTui({ load, today, readOnly: demo });
}

/** `okr protocol`: print PROTOCOL.md from the installed package so agents never need to know where the repo lives. */
function cmdProtocol(): void {
  const path = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'okr', 'PROTOCOL.md');
  if (!existsSync(path)) fail(`找不到 ${path}`);
  const text = readFileSync(path, 'utf8');
  if (json) console.log(JSON.stringify({ ok: true, path, protocol: text }));
  else process.stdout.write(text);
}

const SKILL_USAGE = '用法: okr skill install [--force] | remove | status';

const SKILL_ACTION: Record<string, string> = {
  copied: '已复制',
  'kept-symlink': '已是软链（开发模式），保留',
  linked: '已建软链',
  kept: '软链已在',
  'skipped-dir': '是真实目录，不动',
};

function cmdSkill(): void {
  const sub = args._[1] ?? 'status';
  if (sub === 'install') {
    const r = installSkill({ force });
    ok({ ...r }, () => {
      console.log(`${color(GREEN, '✓')} skill 装好了。`);
      console.log(`  ${r.agents.path}  ${SKILL_ACTION[r.agents.action]}（Codex / Copilot / OpenCode 直接读）`);
      console.log(`  ${r.claude.path}  ${SKILL_ACTION[r.claude.action]}（Claude Code）`);
    });
  } else if (sub === 'remove') {
    const r = removeSkill();
    ok({ ...r }, () => {
      for (const x of r.removed) console.log(`${color(GREEN, '✓')} 已删 ${x}`);
      for (const x of r.kept) console.log(`${dim('·')} 保留 ${x}（不是 okr skill install 装的）`);
      if (!r.removed.length && !r.kept.length) console.log('没有装过。');
    });
  } else if (sub === 'status') {
    const p = skillPaths();
    const st = (x: string) => (existsSync(x) ? '在' : '不在');
    ok({ agents: p.agents, claude: p.claude, installed: existsSync(p.agents) }, () => {
      console.log(`${p.agents}  ${st(p.agents)}`);
      console.log(`${p.claude}  ${st(p.claude)}`);
    });
  } else fail(SKILL_USAGE);
}

function cmdHelp(): void {
  console.log(
    [
      `${bold('okr')} — 目标与任务追踪。事件进，视图出。`,
      '',
      `${bold('结构')}   init · add · edit · move · rm · tree [--all] · show <id> [--spec] · validate [--merge-events] · migrate · repo add|rm|list`,
      `${bold('记录')}   log · done · block · claim · submit --link · reject · assess --value --reason · check · recent [--node] [--days]`,
      `${bold('数据')}   velocity [--weeks]`,
      `${bold('视图')}   tui · status · tree · show`,
      `${bold('协议')}   protocol（打印 PROTOCOL.md，agent 先读它再写）`,
      `${bold('skill')}  skill install [--force] · remove · status（装进 ~/.agents/skills 与 ~/.claude/skills，npm install -g 时自动跑）`,
      '',
      `${bold('通用')}   --json  --today YYYY-MM-DD  --at <时间>  --demo  --by <agent>  --session <id>  --confirmed  --force`,
      `${bold('退出码')} 0 成功 · 1 错误 · 2 指代歧义 · 3 守卫拒绝/validate 失败 · 4 锁超时`,
      '',
      dim(`数据目录 ${store.DIR}（OKR_DIR 可改）。协议 okr protocol；设计 github.com/RoacherM/Wayne-Skills/blob/main/docs/okr/DESIGN.md。`),
    ].join('\n'),
  );
}

// ── dispatch ──────────────────────────────────────────
const STAGE_USAGE = (c: string, extra = '') => `用法: okr ${c} <id> "备注"${extra}`;
/** Argument checks that apply to every command. Runs inside the top-level catch so fail() reports cleanly. */
function checkArgs(): void {
  for (const k of Object.keys(args.flags)) if (!KNOWN_FLAGS.has(k)) fail(`未知参数: --${k}`);
  if (todayFlag !== undefined && !isValidDate(todayFlag)) fail(`--today 需要 YYYY-MM-DD，得到 "${todayFlag}"`);
}

function dispatch(): void {
if (flag('help')) return cmdHelp();
if (flag('version')) { console.log(PKG_VERSION); return; }
checkArgs();
switch (cmd) {
  case 'init': cmdInit(); break;
  case 'add': cmdAdd(); break;
  case 'edit': cmdEdit(); break;
  case 'move': cmdMove(); break;
  case 'rm': cmdRm(); break;
  case 'repo': cmdRepo(); break;
  case 'validate': cmdValidate(); break;
  case 'migrate': cmdMigrate(); break;
  case 'log': appendStageEvent('progress', STAGE_USAGE('log', ' [--value N] [--hours N] [--link URL]'), { noteRequired: true }); break;
  case 'done': appendStageEvent('done', STAGE_USAGE('done', ' [--confirmed] [--hours N]'), { defaultNote: '完成' }); break;
  case 'block': appendStageEvent('blocked', STAGE_USAGE('block'), { noteRequired: true }); break;
  case 'claim': appendStageEvent('claim', STAGE_USAGE('claim', ' --by <agent> --session <id>'), { defaultNote: '领取' }); break;
  case 'submit': appendStageEvent('submit', STAGE_USAGE('submit', ' --link <PR>'), { defaultNote: '已提 PR' }); break;
  case 'reject': appendStageEvent('reject', STAGE_USAGE('reject', ' [--body 详细意见] [--confirmed]'), { noteRequired: true }); break;
  case 'check': appendStageEvent('check', STAGE_USAGE('check'), { defaultNote: '打卡' }); break;
  case 'assess': cmdAssess(); break;
  case 'recent': cmdRecent(); break;
  case 'velocity': cmdVelocity(); break;
  case 'status': cmdStatus(); break;
  case 'tree': cmdTree(); break;
  case 'show': cmdShow(); break;
  case 'protocol': cmdProtocol(); break;
  case 'skill': cmdSkill(); break;
  case 'tui': case '': cmdTui(); break;
  case 'demo':
    if (!process.stdout.isTTY || !process.stdin.isTTY) fail('tui 需要终端。非交互环境用 okr status / okr tree。');
    void runTui({ load: () => ({ nodes: DEMO_NODES, events: DEMO_EVENTS }), today: DEMO_TODAY, readOnly: true });
    break;
  case 'help': case '-h': cmdHelp(); break;
  case 'version': case '-v': console.log(PKG_VERSION); break;
  default:
    fail(`未知命令 ${cmd}。okr help 看用法。`);
}
}
try {
  dispatch();
} catch (err) {
  if (err instanceof CliExit) process.exit(err.code);
  // Anything else (unreadable YAML, a bad line in events.jsonl, EACCES …) still gets the documented shape.
  const msg = err instanceof Error ? err.message : String(err);
  if (json) console.log(JSON.stringify({ ok: false, error: msg, code: 1 }));
  else console.error(color(RED, '✗ ') + msg);
  if (process.env.OKR_DEBUG && err instanceof Error) console.error(err.stack);
  process.exit(1);
}
