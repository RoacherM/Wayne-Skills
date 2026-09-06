import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { AMBER, bold, color, dim, GRAY, GREEN, HEALTH, RED, STAGE_SYM } from './ansi.ts';
import { addDays, dayOf, daysBetween, isValidDate, isValidWeek, nowIso, parseTs, sortEvents, todayIso, tsMs, weekLabel, weekMonday } from './dates.ts';
import { DEMO_EVENTS, DEMO_NODES, DEMO_TODAY } from './demo.ts';
import { MigrateError, migrate } from './migrate.ts';
import { applyPlan, brief, candidates, changes, PlanError, proposalFiles, repoCommits, reportData, resolveSince, weekView } from './plan.ts';
import type { TaskFacts } from './plan.ts';
import { agentCommand, dailyPrompt, defaultTitle, existingReport, jobLabel, KIND_CN, nextPlanFile, normalizePlanWeek, NOTES_SCRIPT, notesBody, parseTime, parseWeekday, plistXml, REPORT_KINDS, reportFile, reportStatus, splitWeekly, weeklyPrompt } from './report.ts';
import type { ReportKind } from './report.ts';
import { descendants, isAncestor, matchNode, newId, project, specComplete, takenIds, velocity } from './project.ts';
import type { Tree } from './project.ts';
import * as store from './store.ts';
import { ensureSkill, installSkill, linkCli, removeSkill, skillPaths } from './skill.ts';
import { runTui } from './tui.ts';
import { KIND_LABEL, STAGE_LABEL } from './types.ts';
import type { Event, EventType, Node, NodeKind, NodeState, Priority, Spec } from './types.ts';
import { mergeEventFiles, validateData, validateDir } from './validate.ts';
import type { MergeResult } from './validate.ts';
import { flagTags, pct, rootIndex } from './views/common.ts';
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

// scripts/build.mjs bakes these in; running from source falls back to the repo files.
declare const __OKR_VERSION__: string | undefined;
declare const __OKR_PROTOCOL__: string | undefined;
const HERE = dirname(fileURLToPath(import.meta.url));
const PKG_VERSION: string = typeof __OKR_VERSION__ === 'string' ? __OKR_VERSION__ : JSON.parse(readFileSync(resolve(HERE, '..', 'package.json'), 'utf8')).version;

const KNOWN_FLAGS = new Set([
  'json', 'demo', 'today', 'by', 'session', 'confirmed', 'force', 'at', 'link', 'hours', 'body', 'repo', 'commit',
  'value', 'node', 'days', 'weeks', 'all', 'spec', 'merge-events', 'kind', 'name', 'area', 'parent', 'start', 'end',
  'weight', 'status', 'metric', 'unit', 'from', 'to', 'cadence', 'habit', 'priority', 'deadline', 'dep', 'deps',
  'week', 'order', 'goal', 'accept', 'verify', 'reason', 'limit', 'help', 'version', 'dir', 'since', 'dismiss', 'dispatchable',
  'stdin', 'title', 'folder', 'probe', 'dry-run', 'daily', 'weekly', 'weekday', 'agent', 'skip-probe',
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
function preWrite(): void {
  if (demo) fail('--demo 是只读的');
  if (str('today') !== undefined) fail('--today 只影响读，写入命令不接受', 1);
  requireData();
  // Event arguments are checked before the lock so a bad --at / --hours cannot fail after nodes.yaml is already on disk.
  eventTs();
  num('hours');
}

function write<T extends Record<string, unknown>>(fn: (nodes: Node[], events: Event[]) => { data: T; msg: string; human: () => void }): void {
  preWrite();
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
    if (!existsSync(resolve(path, '.git'))) warnings.push('目录里没有 .git，okr commits 会跳过它');
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

// ── commands: planning data ───────────────────────────
// Facts for the skill (DESIGN §3 / PROTOCOL §2 §6). Ranking and wording stay in the agent.
const weekFlag = (t: Tree): string => {
  const w = str('week');
  if (w === undefined) return t.week;
  if (!isValidWeek(w)) fail(`--week 格式：2026-W36，得到 "${w}"`);
  return w;
};

function taskLine(f: TaskFacts, opts: { order?: boolean } = {}): string {
  const st = STAGE_SYM[f.stage];
  const bits = [
    opts.order ? dim(f.order === null ? ' -' : String(f.order).padStart(2)) : '',
    color(st.c, st.sym),
    bold(f.id),
    f.name,
    f.priority ? dim(f.priority) : '',
    f.deadline ? (f.daysLeft !== null && f.daysLeft < 0 ? color(RED, `~${f.deadline}`) : dim(`~${f.deadline}`)) : '',
    flagTags(f.flags.filter((x) => x !== 'carry-over')),
    f.claimed ? dim(`@${f.claimed.by}`) : '',
  ].filter(Boolean);
  return ' ' + bits.join('  ');
}

function cmdBrief(): void {
  const t = buildTree();
  const { events } = load();
  const b = brief(t, events, store.REPORTS);
  ok({ ...b }, () => {
    if (b.empty) {
      console.log(`${color(GREEN, '✓')} ${today} ${dim(t.week)}  一切正常，没什么要提的。`);
      return;
    }
    console.log(`${bold(today)} ${dim(t.week)}`);
    const section = (title: string, c: number, rows: TaskFacts[]) => {
      if (!rows.length) return;
      console.log(color(c, ` ${title} (${rows.length})`));
      for (const f of rows) console.log(taskLine(f));
    };
    section('已逾期', RED, b.overdue);
    section('将到期', AMBER, b.dueSoon);
    section('阻塞', RED, b.blocked);
    section('停滞', GRAY, b.stale);
    section('待验收超时', AMBER, b.reviewStale);
    section('已领取', GRAY, b.claimed);
    if (b.behind.length) {
      console.log(color(AMBER, ` 上层落后 (${b.behind.length})`));
      for (const u of b.behind) {
        const h = HEALTH[u.health];
        console.log(`  ${color(h.c, h.sym)} ${bold(u.id)}  ${u.name}  ${dim(`${h.label} · 进度 ${pct(u.progress)} / 时间 ${pct(u.elapsed)}${u.daysQuiet !== null ? ` · ${u.daysQuiet} 天没动静` : ''}`)}`);
      }
    }
    if (b.proposals.length) {
      console.log(color(AMBER, ` 待处理的周计划提案 (${b.proposals.length})`));
      for (const p of b.proposals) console.log(`  ${p.file}  ${dim('okr apply --from ' + p.file + ' --confirmed，或 --dismiss')}`);
    }
  });
}

function cmdWeek(): void {
  const t = buildTree();
  const { events } = load();
  const w = weekView(t, events, store.REPORTS, weekFlag(t));
  ok({ ...w, today }, () => {
    const prop = w.proposal === 'none' ? '' : `  提案 ${w.proposal}${w.proposals.length > 1 ? ` (${w.proposals.length})` : ''}`;
    console.log(`${bold(w.week)} ${dim(`${w.start.slice(5)} → ${w.end.slice(5)}`)}${w.current ? dim('  本周') : ''}${color(w.proposal === 'pending' ? AMBER : GRAY, prop)}`);
    if (!w.planned.length) console.log(dim(' 这周还没排任务。okr candidates 看候选，提案写到 reports/' + w.week + '.plan.yaml 再 okr apply。'));
    for (const f of w.planned) console.log(taskLine(f, { order: true }));
    if (w.carryOver.length) {
      console.log(color(AMBER, ` 遗留 (${w.carryOver.length})`) + dim('  上周及更早排的，未完成；apply 时必须进 plan 或 drop'));
      for (const f of w.carryOver) console.log(taskLine(f) + dim(`  ${f.week}`));
    }
  });
}

function cmdCandidates(): void {
  const t = buildTree();
  const rows = candidates(t, { dispatchable: flag('dispatchable') });
  ok({ today, week: t.week, candidates: rows }, () => {
    if (!rows.length) {
      console.log(dim(flag('dispatchable') ? '没有可派工的任务（spec 齐全、依赖已完成）。' : '没有未完成的任务。'));
      return;
    }
    console.log(dim(` ${rows.length} 个候选 · 按优先级 → 截止 排序，怎么选看 protocol §6`));
    for (const c of rows) {
      const tags = [
        c.planned ? dim(c.week!) : '',
        c.carryOver ? color(AMBER, '遗留') : '',
        c.upper ? dim(`${c.upper.id}${c.upper.gap !== null ? ` ${c.upper.gap >= 0 ? '+' : ''}${Math.round(c.upper.gap * 100)}%` : ''}`) : '',
        c.depsOpen ? color(AMBER, `等 ${c.deps.filter((d) => !d.done).map((d) => d.id).join(',')}`) : '',
        c.dependents.length ? dim(`→ ${c.dependents.join(',')}`) : '',
        c.dispatchable ? color(GREEN, '可派') : c.specMissing.length ? dim(`缺 ${c.specMissing.join('/')}`) : '',
      ].filter(Boolean);
      console.log(taskLine(c) + '  ' + tags.join('  '));
    }
  });
}

function sinceOrFail(events: Event[], dflt: string): { spec: string; since: string | null; anchor: Event | null } {
  const spec = str('since') ?? dflt;
  const r = resolveSince(events, spec);
  if (!r) fail(`--since 接受 last-daily / last-weekly / 日期 / ISO 时间，得到 "${spec}"`);
  return r;
}

function cmdChanges(): void {
  const t = buildTree();
  const { events } = load();
  const s = sinceOrFail(events, 'last-daily');
  const rows = changes(events, s.since);
  ok({ since: s.since, spec: s.spec, anchor: s.anchor, events: rows, today }, () => {
    console.log(dim(s.since ? ` 自 ${s.since}${s.anchor ? `（上次 ${s.anchor.kind === 'daily' ? '日报' : '周报'}）` : ''} 起 ${rows.length} 条` : ` 没有${s.spec === 'last-daily' ? '日报' : '周报'}锚点，列出全部 ${rows.length} 条`));
    if (rows.length) console.log(renderEvents(t, { width: cols, events: rows }).join('\n'));
  });
}

function cmdCommits(): void {
  requireData();
  const { events } = load();
  const s = sinceOrFail(events, 'last-weekly');
  const limit = num('limit') ?? 200;
  if (limit < 1) fail('--limit 至少为 1');
  const node = str('node');
  let repos = store.loadRepos();
  if (node) repos = repos.filter((r) => r.node === node);
  const rows = repoCommits(repos, s.since, limit);
  ok({ since: s.since, spec: s.spec, limit, repos: rows, today }, () => {
    if (!rows.length) {
      console.log(dim(node ? `没有登记到 ${node} 的仓库。` : '没有登记仓库。okr repo add <path> --node <id>'));
      return;
    }
    console.log(dim(s.since ? ` 自 ${s.since}${s.anchor ? '（上次周报）' : ''} 起` : ' 没有周报锚点，取最近的提交'));
    for (const r of rows) {
      console.log(`${bold(r.path)}${r.node ? dim(`  → ${r.node}`) : ''}${r.error ? color(RED, `  ✗ ${r.error}`) : dim(`  ${r.commits.length} 个提交`)}`);
      for (const c of r.commits) console.log(`  ${dim(c.date.slice(0, 10))} ${color(GRAY, c.hash)} ${c.subject}${dim(` — ${c.author}`)}`);
    }
  });
}

/** `--from` is taken as given, then looked up under reports/; the basename is what plan events record. */
function planPath(): string {
  const from = str('from');
  if (!from) fail('用法: okr apply --from <plan.yaml> --confirmed | okr apply --dismiss [--from <plan.yaml>]');
  const direct = resolve(from);
  if (existsSync(direct)) return direct;
  const inReports = resolve(store.REPORTS, from);
  if (existsSync(inReports)) return inReports;
  fail(`找不到 ${from}（也不在 ${store.REPORTS}）`);
}

function cmdApply(): void {
  if (flag('dismiss')) return cmdDismiss();
  const path = planPath();
  let parsed: unknown;
  try {
    parsed = YAML.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    fail(`${path} 不是合法 YAML: ${(err as Error).message.split('\n')[0]}`);
  }
  if (!confirmed) fail('apply 会改结构，要 --confirmed（skill 在用户看过提案点头后传）', 3);
  const file = basename(path);
  write((nodes, events) => {
    const t = project(nodes, events, today);
    let r;
    try {
      r = applyPlan(nodes, events, t, parsed as Parameters<typeof applyPlan>[3]);
    } catch (err) {
      if (err instanceof PlanError) fail(err.message, err.code, err.extra);
      throw err;
    }
    const v = guardValidate(nodes, r.nodes, events);
    const warnings = [...r.warnings, ...v.warnings.filter((w) => r.created.some((c) => w.startsWith(`节点 ${c.id} `)) || r.planned.some((p) => w.startsWith(`节点 ${p.id} `)))];
    if (resolve(dirname(path)) !== resolve(store.REPORTS)) warnings.push(`${file} 不在 ${store.REPORTS} 下，week --json 的 proposal 不会追踪它`);
    store.saveNodes(r.nodes);
    const written: Event[] = [];
    for (const c of r.created) written.push(mkEvent(c.id, 'change', `add ${describe(c)}`));
    for (const n of r.notes) written.push(mkEvent(n.id, 'change', n.note));
    const summary = `apply ${file}: ${r.week} 新建 ${r.created.length}，计划 ${r.planned.length}，退出 ${r.dropped.length}${r.kept.length ? `，保留 ${r.kept.length}` : ''}`;
    written.push(mkEvent(null, 'plan', summary, { source: file, week: r.week }));
    for (const e of written) store.appendEvent(e);
    const after = project(r.nodes, [...events, ...written], today);
    const w = weekView(after, [...events, ...written], store.REPORTS, r.week);
    return {
      data: { week: r.week, file, created: r.created, planned: r.planned, kept: r.kept, dropped: r.dropped, warnings, events: written, plan: w.planned },
      msg: summary,
      human: () => {
        console.log(`${color(GREEN, '✓')} ${summary}`);
        for (const f of w.planned) console.log(taskLine(f, { order: true }));
        for (const d of r.dropped) console.log(dim(`  退出 ${d.id}（原 ${d.before}）`));
        for (const x of warnings) console.log(color(AMBER, '  ! ') + x);
      },
    };
  });
}

function cmdDismiss(): void {
  const from = str('from');
  write((nodes, events) => {
    const t = project(nodes, events, today);
    let files = proposalFiles(store.REPORTS, from ? (/^(\d{4}-W\d{2})\./.exec(basename(from))?.[1] ?? t.week) : weekFlag(t), events);
    if (from) files = files.filter((f) => f.file === basename(from));
    if (from && !files.length) fail(`${basename(from)} 不在 ${store.REPORTS} 下，或不符合 <周>.plan[-N].yaml 命名`);
    const pending = files.filter((f) => f.status === 'pending');
    if (!pending.length) fail(from ? `${basename(from)} 已经处理过（${files[0].status}）` : `${t.week} 没有待处理的提案`, 3, { files });
    const written = pending.map((f) => mkEvent(null, 'plan', `dismiss ${f.file}`, { source: f.file, week: f.week, dismissed: true }));
    for (const e of written) store.appendEvent(e);
    return {
      data: { dismissed: pending.map((f) => f.file), events: written },
      msg: `dismiss ${pending.map((f) => f.file).join(' ')}`,
      human: () => console.log(`${color(GREEN, '✓')} 已放弃提案 ${pending.map((f) => f.file).join('、')}`),
    };
  });
}

// ── reports: write / status, notes delivery, launchd jobs ──────────────

function reportKind(dflt: ReportKind): ReportKind {
  const k = str('kind') ?? dflt;
  if (!(REPORT_KINDS as readonly string[]).includes(k)) fail(`--kind 只接受 daily / weekly，得到 "${k}"`);
  return k as ReportKind;
}

/** The period a report covers: today for daily, --week (default this week) for weekly. */
function reportLabelFor(kind: ReportKind, t: Tree): string {
  return kind === 'daily' ? today : weekFlag(t);
}

/** Markdown from --from <file> (`-` = stdin, bare names looked up under reports/) or --stdin. */
function readContent(usage: string): string {
  const from = str('from');
  if (flag('stdin') || from === '-') return readFileSync(0, 'utf8');
  if (!from) fail(usage);
  const path = existsSync(from) ? from : resolve(store.REPORTS, from);
  if (!existsSync(path)) fail(`找不到 ${from}`);
  return readFileSync(path, 'utf8');
}

interface ReportResult {
  event: Event | null;
  existing: Event | null;
  committed: boolean;
  backup: { path: string; ok: boolean; error?: string } | null;
}

/**
 * Record a report under the lock: run `save` (files), append one report event unless this period already has one
 * (a re-run after a missed slot only refreshes files), commit, then `git bundle` to the backup dir (DESIGN §9). Never prints the result.
 */
function finishReport(kind: ReportKind, label: string, note: string, extra: Partial<Event> = {}, save?: () => void): ReportResult {
  try {
    return store.withLock(() => {
      const events = store.loadEvents();
      const existing = existingReport(events, kind, label);
      save?.();
      let event: Event | null = null;
      if (!existing) {
        event = mkEvent(null, 'report', note, { kind, ...(kind === 'weekly' ? { week: label } : {}), ...extra });
        store.appendEvent(event);
      }
      const c = store.commit(`report ${kind} ${label}`);
      if (!c.committed) console.error(color(RED, '! ') + `git commit 失败（文件已写入）: ${c.error ?? ''}`);
      const backup = event ? store.backup() : null;
      if (backup && !backup.ok) console.error(color(AMBER, '! ') + `git bundle 备份失败: ${backup.error}`);
      return { event, existing, committed: c.committed, backup };
    });
  } catch (err) {
    if (err instanceof store.LockTimeout) fail(err.message, 4);
    throw err;
  }
}

function cmdReportStatus(): void {
  const t = buildTree();
  const { events } = load();
  const s = reportStatus(events, today, t.week);
  ok({ ...s }, () => {
    const line = (k: ReportKind, last: Event | null, cur: Event | null, what: string) =>
      console.log(`${cur ? color(GREEN, '✓') : dim('·')} ${KIND_CN[k]}  ${cur ? `${what}已写（${cur.ts.slice(0, 16)}${cur.by ? `，${cur.by}` : ''}）` : `${what}还没写`}${last ? dim(`  上次 ${dayOf(last.ts)}`) : dim('  从未写过')}`);
    line('daily', s.daily.last, s.daily.today, '今天');
    line('weekly', s.weekly.last, s.weekly.thisWeek, `${t.week} `);
  });
}

function cmdReportWrite(): void {
  preWrite();
  const kind = reportKind('weekly');
  const t = buildTree();
  const label = reportLabelFor(kind, t);
  const content = readContent('用法: okr report write --kind daily|weekly [--week W] --from <report.md>|--stdin [--force]');
  if (!content.trim()) fail('报告内容为空');
  const file = reportFile(label);
  const path = resolve(store.REPORTS, file);
  if (existsSync(path) && !force) fail(`${file} 已存在，--force 覆盖`, 3, { file });
  const r = finishReport(kind, label, `${KIND_CN[kind]} ${label} → ${file}`, { source: file }, () => {
    mkdirSync(store.REPORTS, { recursive: true });
    writeFileSync(path, content.endsWith('\n') ? content : content + '\n');
  });
  ok({ kind, label, file, path, event: r.event, existing: r.existing, committed: r.committed, backup: r.backup?.ok ? r.backup.path : null }, () => {
    console.log(`${color(GREEN, '✓')} 已存 ${path}`);
    console.log(r.event ? dim(`  记 report 事件（${kind} ${label}）`) : dim(`  ${label} 的${KIND_CN[kind]}事件已有（${r.existing!.ts.slice(0, 16)}），不重复记`));
    if (r.backup?.ok) console.log(dim(`  备份 ${r.backup.path}`));
  });
}

/** Upsert one note (folder / title) in Apple Notes through osascript. Errors come back, the caller decides whether they are fatal. */
function pushNote(folder: string, title: string, md: string): { ok: true; result: string } | { ok: false; error: string } {
  if (process.platform !== 'darwin') return { ok: false, error: 'deliver notes 只在 macOS 上可用（需要备忘录 app）' };
  try {
    const out = execFileSync('osascript', ['-', folder, title, notesBody(title, md)], { input: NOTES_SCRIPT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 120_000 });
    return { ok: true, result: out.trim() || 'ok' };
  } catch (err) {
    const e = err as { stderr?: string; message: string };
    const msg = (e.stderr ?? e.message).trim().split('\n').pop() ?? '';
    const auth = /-1743|-600|not allowed|not authorized|未授权|不允许/i.test(msg) ? '。先在终端跑一次 okr deliver notes --probe 完成自动化授权（系统设置 → 隐私与安全性 → 自动化）' : '';
    return { ok: false, error: `写备忘录失败: ${msg}${auth}` };
  }
}

function cmdDeliver(): void {
  if (args._[1] !== 'notes') fail('用法: okr deliver notes [--kind daily|weekly] [--week W] --from <md>|--stdin [--title T] [--folder OKR] [--dry-run] | deliver notes --probe');
  const folder = str('folder') ?? 'OKR';
  if (flag('probe')) {
    const title = 'OKR 授权测试';
    const md = `okr deliver notes --probe 在 ${nowIso()} 写入。看到这条说明备忘录自动化授权已完成，可以删掉。`;
    if (flag('dry-run')) return ok({ folder, title, html: notesBody(title, md) }, () => console.log(notesBody(title, md)));
    const r = pushNote(folder, title, md);
    if (!r.ok) fail(r.error);
    return ok({ folder, title, result: r.result }, () => console.log(`${color(GREEN, '✓')} 备忘录 ${folder} / ${title}（${r.result}）。授权完成，launchd 任务可以写备忘录了。`));
  }
  const kind = reportKind('daily');
  const t = buildTree();
  const label = reportLabelFor(kind, t);
  const content = readContent('用法: okr deliver notes [--kind daily|weekly] --from <md>|--stdin [--title T]');
  if (!content.trim()) fail('内容为空');
  const title = str('title') ?? defaultTitle(kind, label);
  if (flag('dry-run')) return ok({ kind, label, folder, title, html: notesBody(title, content) }, () => console.log(notesBody(title, content)));
  preWrite();
  const p = pushNote(folder, title, content);
  if (!p.ok) fail(p.error);
  const r = finishReport(kind, label, `${KIND_CN[kind]} ${label} → 备忘录 ${folder}/${title}`);
  ok({ kind, label, folder, title, result: p.result, event: r.event, existing: r.existing, committed: r.committed, backup: r.backup?.ok ? r.backup.path : null }, () => {
    console.log(`${color(GREEN, '✓')} 备忘录 ${folder} / ${title}（${p.result === 'updated' ? '已更新' : '已新建'}）`);
    console.log(r.event ? dim(`  记 report 事件（${kind} ${label}）`) : dim(`  ${label} 的${KIND_CN[kind]}事件已有，不重复记`));
  });
}

// ── launchd ──────────────────────────────────────────
const LAUNCH_AGENTS = join(homedir(), 'Library', 'LaunchAgents');
const plistPath = (kind: ReportKind) => join(LAUNCH_AGENTS, `${jobLabel(kind)}.plist`);

/** --agent / OKR_AGENT: a path, or a name looked up on PATH and the usual install dirs. */
/** The plist hardcodes node; prefer the PATH entry (e.g. /opt/homebrew/bin/node) over the versioned Cellar path it resolves to, so a brew upgrade does not break the job. */
function stableNode(): string {
  const real = (p: string) => {
    try {
      return realpathSync(p);
    } catch {
      return '';
    }
  };
  const target = real(process.execPath);
  for (const d of (process.env.PATH ?? '').split(':')) {
    const c = join(d, 'node');
    if (d && !d.includes('node_modules') && existsSync(c) && real(c) === target) return c;
  }
  return process.execPath;
}

function findAgent(): string | null {
  const want = str('agent') ?? process.env.OKR_AGENT ?? 'claude';
  if (want.includes('/')) return existsSync(want) ? resolve(want) : null;
  const dirs = [...(process.env.PATH ?? '').split(':'), '/opt/homebrew/bin', '/usr/local/bin', join(homedir(), '.local', 'bin'), join(homedir(), '.claude', 'local', 'bin'), join(homedir(), '.npm-global', 'bin')];
  for (const d of dirs) if (d && existsSync(join(d, want))) return join(d, want);
  return null;
}

function launchctl(a: string[]): { ok: boolean; out: string } {
  try {
    return { ok: true, out: execFileSync('launchctl', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (err) {
    const e = err as { stderr?: string; stdout?: string; message: string };
    return { ok: false, out: (e.stderr || e.stdout || e.message).trim() };
  }
}

function cmdJob(): void {
  const sub = args._[1];
  const usage = '用法: okr job install [--daily 11:00] [--weekly 10:00] [--weekday mon] [--agent claude|codex|<路径>] [--skip-probe] | job remove | job status | job run daily|weekly [--dry-run]';
  if (sub === 'run') return cmdJobRun();
  if (sub === 'status') return cmdJobStatus();
  if (process.platform !== 'darwin') fail('okr job 用 launchd，只在 macOS 上可用');
  if (sub === 'remove') return cmdJobRemove();
  if (sub !== 'install') fail(usage);
  if (demo) fail('--demo 是只读的');
  requireData();
  const daily = parseTime(str('daily') ?? '11:00');
  const weekly = parseTime(str('weekly') ?? '10:00');
  const weekday = parseWeekday(str('weekday') ?? 'mon');
  if (!daily || !weekly) fail('--daily / --weekly 要 HH:MM');
  if (weekday === null) fail('--weekday 要 mon…sun 或 0–6');
  const agent = findAgent();
  if (!agent) fail(`找不到 agent 可执行文件 ${str('agent') ?? process.env.OKR_AGENT ?? 'claude'}，用 --agent 给绝对路径`);
  const node = stableNode();
  const script = realpathSync(process.argv[1]);
  const uid = process.getuid!();
  mkdirSync(store.LOGS, { recursive: true });
  mkdirSync(LAUNCH_AGENTS, { recursive: true });
  const env: Record<string, string> = {
    HOME: homedir(),
    OKR_DIR: store.DIR,
    OKR_AGENT: agent,
    OKR_SKIP_SKILL: '1',
    LANG: process.env.LANG ?? 'zh_CN.UTF-8',
    PATH: [dirname(node), dirname(agent), '/usr/local/bin', '/opt/homebrew/bin', '/usr/bin', '/bin'].filter((v, i, a) => a.indexOf(v) === i).join(':'),
  };
  if (process.env.TMPDIR) env.TMPDIR = process.env.TMPDIR; // the write lock lives there; launchd's default would be /tmp and miss it
  if (process.env.OKR_AGENT_ARGS) env.OKR_AGENT_ARGS = process.env.OKR_AGENT_ARGS;
  const jobs: { kind: ReportKind; label: string; plist: string; at: string; log: string }[] = [];
  for (const kind of REPORT_KINDS) {
    const time = kind === 'daily' ? daily : weekly;
    const label = jobLabel(kind);
    const log = join(store.LOGS, `${kind}.log`);
    const path = plistPath(kind);
    writeFileSync(path, plistXml({ label, program: [node, script, 'job', 'run', kind], hour: time.hour, minute: time.minute, weekday: kind === 'weekly' ? weekday : undefined, env, log, workdir: store.DIR }));
    launchctl(['bootout', `gui/${uid}/${label}`]);
    const b = launchctl(['bootstrap', `gui/${uid}`, path]);
    if (!b.ok) fail(`launchctl bootstrap ${label} 失败: ${b.out}`);
    jobs.push({ kind, label, plist: path, at: `${kind === 'weekly' ? `weekday ${weekday} ` : '每天 '}${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`, log });
  }
  let probe: string | null = null;
  if (!flag('skip-probe')) {
    const p = pushNote(str('folder') ?? 'OKR', 'OKR 授权测试', `okr job install 在 ${nowIso()} 写入。看到这条说明备忘录自动化授权已完成，可以删掉。`);
    if (!p.ok) fail(`任务已安装，但${p.error}`);
    probe = p.result;
  }
  ok({ node, script, agent, jobs, probe }, () => {
    console.log(`${color(GREEN, '✓')} 已安装 launchd 任务`);
    for (const j of jobs) console.log(`  ${KIND_CN[j.kind]}  ${j.at}  ${dim(j.plist)}`);
    console.log(dim(`  node  ${node}\n  okr   ${script}\n  agent ${agent}\n  日志  ${store.LOGS}/`));
    console.log(probe ? `${color(GREEN, '✓')} 备忘录授权测试通过（${probe}）` : dim('  跳过了备忘录授权测试；手动跑一次 okr deliver notes --probe'));
    console.log(dim('  试跑 okr job run daily --dry-run 看给 agent 的提示词；okr job status 看状态'));
  });
}

function cmdJobRemove(): void {
  const uid = process.getuid!();
  const removed: string[] = [];
  for (const kind of REPORT_KINDS) {
    launchctl(['bootout', `gui/${uid}/${jobLabel(kind)}`]);
    const p = plistPath(kind);
    if (existsSync(p)) {
      unlinkSync(p);
      removed.push(p);
    }
  }
  ok({ removed }, () => console.log(removed.length ? `${color(GREEN, '✓')} 已卸载 ${removed.join('、')}` : dim('没有安装过 okr 的 launchd 任务')));
}

function cmdJobStatus(): void {
  const t = buildTree();
  const { events } = load();
  const s = reportStatus(events, today, t.week);
  const uid = process.getuid?.() ?? 0;
  const jobs = REPORT_KINDS.map((kind) => {
    const plist = plistPath(kind);
    const p = process.platform === 'darwin' ? launchctl(['print', `gui/${uid}/${jobLabel(kind)}`]) : { ok: false, out: '' };
    const log = join(store.LOGS, `${kind}.log`);
    let lastRun: string | null = null;
    try {
      lastRun = nowIso(statSync(log).mtime);
    } catch {
      /* no log yet */
    }
    const cur = kind === 'daily' ? s.daily.today : s.weekly.thisWeek;
    const last = kind === 'daily' ? s.daily.last : s.weekly.last;
    return { kind, label: jobLabel(kind), plist: existsSync(plist) ? plist : null, loaded: p.ok, log, lastRun, lastReport: last?.ts ?? null, current: cur?.ts ?? null };
  });
  ok({ jobs, today, week: t.week }, () => {
    for (const j of jobs) {
      const state = j.loaded ? '已加载' : j.plist ? '未加载（plist 在，launchctl 没接管）' : '未安装';
      console.log(`${j.loaded ? color(GREEN, '●') : dim('○')} ${KIND_CN[j.kind]}  ${state}${j.lastRun ? dim(`  上次运行 ${j.lastRun.slice(0, 16)}`) : ''}${j.lastReport ? dim(`  上次报告 ${j.lastReport.slice(0, 10)}`) : dim('  还没写过报告')}${j.current ? color(GREEN, `  ${j.kind === 'daily' ? '今天' : '本周'}已写`) : ''}`);
    }
    console.log(dim(`  日志 ${store.LOGS}/  安装 okr job install  卸载 okr job remove`));
  });
}

function runAgent(prompt: string): string {
  const bin = findAgent();
  if (!bin) fail('找不到 agent 可执行文件（--agent 或 OKR_AGENT）');
  const extra = (process.env.OKR_AGENT_ARGS ?? '').split(/\s+/).filter(Boolean);
  const { cmd, args: a } = agentCommand(bin, extra);
  console.error(dim(`[${nowIso()}] agent: ${cmd} ${a.join(' ')}`));
  try {
    return execFileSync(cmd, a, { input: prompt, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 20 * 60_000, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, OKR_SKIP_SKILL: '1' } }).trim();
  } catch (err) {
    const e = err as { stderr?: string; message: string };
    fail(`agent 运行失败: ${(e.stderr || e.message).trim().split('\n').slice(-3).join(' | ')}`);
  }
}

/**
 * What launchd runs. Daily: skip when today's report exists; nothing new → "暂无更新" straight to Notes; otherwise the agent
 * writes from changes + brief + plan. Weekly: the agent reviews last week and proposes this week; markdown → reports/<week>.md,
 * the trailing yaml block → reports/<week>.plan.yaml, a copy to Notes. --dry-run prints the prompt and writes nothing.
 */
function cmdJobRun(): void {
  const kind = args._[2] as ReportKind;
  if (!(REPORT_KINDS as readonly string[]).includes(kind)) fail('用法: okr job run daily|weekly [--dry-run] [--agent <bin>]');
  const dry = flag('dry-run');
  if (dry) requireData();
  else preWrite();
  const t = buildTree();
  const { events } = load();
  const log = (m: string) => console.error(dim(`[${nowIso()}] ${m}`));
  const label = kind === 'daily' ? today : t.week;
  const existing = existingReport(events, kind, label);
  if (existing && !dry) {
    log(`${KIND_CN[kind]} ${label} 已有 report 事件（${existing.ts}），跳过`);
    return ok({ kind, label, skipped: 'exists', existing }, () => console.log(dim(`${KIND_CN[kind]} ${label} 已写过，跳过`)));
  }
  const folder = str('folder') ?? 'OKR';
  if (kind === 'daily') {
    const s = resolveSince(events, 'last-daily')!;
    const rows = changes(events, s.since);
    const b = brief(t, events, store.REPORTS);
    const w = weekView(t, events, store.REPORTS);
    const title = defaultTitle('daily', label);
    if (!rows.length && b.empty) {
      log('没有新事件、没有要提醒的，直接写「暂无更新」');
      const md = `暂无更新：自${s.since ? `上次日报（${s.since.slice(0, 16)}）` : '开始'}起没有新事件，也没有到期、阻塞、停滞的任务。`;
      if (dry) return ok({ kind, label, quiet: true, markdown: md }, () => console.log(md));
      const p = pushNote(folder, title, md);
      if (!p.ok) fail(p.error);
      const r = finishReport('daily', label, `日报 ${label} → 备忘录 ${folder}/${title}（暂无更新）`, { by: 'launchd' });
      return ok({ kind, label, quiet: true, title, result: p.result, event: r.event }, () => console.log(`${color(GREEN, '✓')} 日报 ${label}：暂无更新（备忘录 ${p.result}）`));
    }
    const payload = { today, week: t.week, since: s.since, changes: rows, brief: b, plan: { planned: w.planned, carryOver: w.carryOver, proposal: w.proposal, proposals: w.proposals }, candidates: candidates(t).slice(0, 30) };
    const prompt = dailyPrompt(payload);
    if (dry) return ok({ kind, label, quiet: false, prompt }, () => console.log(prompt));
    const md = runAgent(prompt);
    if (!md) fail('agent 没有输出');
    mkdirSync(store.LOGS, { recursive: true });
    writeFileSync(join(store.LOGS, `${label}.daily.md`), md + '\n');
    const p = pushNote(folder, title, md);
    if (!p.ok) fail(`${p.error}（正文已存 ${join(store.LOGS, `${label}.daily.md`)}）`);
    const r = finishReport('daily', label, `日报 ${label} → 备忘录 ${folder}/${title}`, { by: 'launchd' });
    return ok({ kind, label, title, result: p.result, event: r.event, chars: md.length }, () => console.log(`${color(GREEN, '✓')} 日报 ${label} 已写到备忘录（${p.result}，${md.length} 字）`));
  }
  // weekly: review the week that just ended, propose the one starting
  const prev = weekLabel(addDays(weekMonday(t.week)!, -1));
  const review = reportData(t, events, store.REPORTS, prev);
  const s = resolveSince(events, 'last-weekly')!;
  const rows = changes(events, s.since);
  const commits = repoCommits(store.loadRepos(), s.since, 100);
  const w = weekView(t, events, store.REPORTS);
  const payload = {
    today,
    thisWeek: { week: t.week, start: w.start, end: w.end, planned: w.planned, carryOver: w.carryOver, proposal: w.proposal },
    review: { ...review, brief: undefined, candidates: undefined, plan: undefined },
    brief: review.brief,
    candidates: candidates(t),
    changes: rows,
    commits,
  };
  const prompt = weeklyPrompt(payload);
  if (dry) return ok({ kind, label, prompt }, () => console.log(prompt));
  const out = runAgent(prompt);
  if (!out) fail('agent 没有输出');
  const { markdown, plan: rawPlan } = splitWeekly(out);
  const plan = rawPlan ? normalizePlanWeek(rawPlan, label) : null;
  const file = reportFile(label);
  const planFile = plan ? nextPlanFile(label, existsSync(store.REPORTS) ? readdirSync(store.REPORTS) : []) : null;
  const md = planFile ? `${markdown}\n> 本周提案已存为 ${planFile}：确认就 \`okr apply --from ${planFile} --confirmed\`，不要就 \`okr apply --dismiss\`。\n` : markdown;
  const r = finishReport('weekly', label, `周报 ${label} → ${file}${planFile ? ` + ${planFile}` : ''}`, { by: 'launchd', source: file }, () => {
    mkdirSync(store.REPORTS, { recursive: true });
    writeFileSync(resolve(store.REPORTS, file), md);
    if (plan && planFile) writeFileSync(resolve(store.REPORTS, planFile), plan);
  });
  const p = pushNote(folder, defaultTitle('weekly', label), md);
  if (!p.ok) log(`${p.error}；周报已存 reports/${file}`);
  return ok({ kind, label, file, planFile, notes: p.ok ? p.result : null, event: r.event, chars: md.length }, () =>
    console.log(`${color(GREEN, '✓')} 周报 ${label} 已存 reports/${file}${planFile ? `，提案 ${planFile}` : ''}${p.ok ? `，备忘录 ${p.result}` : ''}`),
  );
}

function cmdReport(): void {
  const sub = args._[1];
  if (sub === 'write') return cmdReportWrite();
  if (sub === 'status') return cmdReportStatus();
  if (sub !== 'data') fail('用法: okr report data [--week W] | report write --kind daily|weekly [--week W] --from <md>|--stdin [--force] | report status');
  const t = buildTree();
  const { events } = load();
  const r = reportData(t, events, store.REPORTS, weekFlag(t));
  ok({ ...r }, () => {
    console.log(`${bold(r.week)} ${dim(`${r.start} → ${r.end}`)}${r.current ? dim('  本周') : ''}`);
    const moved = r.nodes.filter((n) => n.kind !== 'task' && n.kind !== 'habit');
    if (moved.length) {
      console.log(dim(' 目标 / KR / 里程碑'));
      for (const n of moved) {
        const h = HEALTH[n.health];
        const delta = n.delta === null ? '' : n.delta === 0 ? dim('  —') : color(n.delta > 0 ? GREEN : RED, `  ${n.delta > 0 ? '+' : ''}${Math.round(n.delta * 100)}%`);
        console.log(`  ${'  '.repeat(n.depth)}${color(h.c, h.sym)} ${bold(n.id)} ${n.name}  ${dim(pct(n.progress))}${delta}${n.current !== null ? dim(`  ${n.current}${n.unit ?? ''}`) : ''}`);
      }
    }
    console.log(dim(` 完成 ${r.done.length} 个任务`) + (r.done.length ? '  ' + r.done.map((d) => `${d.id}${d.hours !== null ? `(${d.hours}h)` : ''}`).join(' ') : ''));
    const ev = Object.entries(r.events).map(([k, v]) => `${k} ${v}`).join(' · ');
    if (ev) console.log(dim(` 事件  ${ev}`));
    console.log(dim(` 周计划 ${r.plan.planned.length} 个，遗留 ${r.plan.carryOver.length} 个，提案 ${r.plan.proposal}`));
    if (!r.brief.empty) console.log(dim(` 待关注  逾期 ${r.brief.overdue.length} · 将到期 ${r.brief.dueSoon.length} · 阻塞 ${r.brief.blocked.length} · 停滞 ${r.brief.stale.length} · 上层落后 ${r.brief.behind.length}`));
    console.log(dim(' 完整数据 okr report data --json'));
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
  let text: string;
  let path = 'bundled';
  if (typeof __OKR_PROTOCOL__ === 'string') text = __OKR_PROTOCOL__;
  else {
    path = resolve(HERE, '..', 'docs', 'okr', 'PROTOCOL.md');
    if (!existsSync(path)) fail(`找不到 ${path}`);
    text = readFileSync(path, 'utf8');
  }
  if (json) console.log(JSON.stringify({ ok: true, path, protocol: text }));
  else process.stdout.write(text);
}

const SKILL_USAGE = '用法: okr skill install [--force] | remove | status | link [--dir ~/.local/bin]';

const SKILL_ACTION: Record<string, string> = {
  copied: '已复制',
  'kept-symlink': '已是软链（开发模式），保留',
  linked: '已建软链',
  kept: '软链已在',
  'skipped-dir': '是真实目录，不动',
  'in-place': '就是这份，不动',
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
    ok({ agents: p.agents, claude: p.claude, installed: existsSync(p.agents), running: process.argv[1] }, () => {
      console.log(`${p.agents}  ${st(p.agents)}`);
      console.log(`${p.claude}  ${st(p.claude)}`);
      console.log(dim(`当前运行的是 ${process.argv[1]}`));
    });
  } else if (sub === 'link') {
    const r = linkCli({ dir: str('dir') });
    ok({ ...r }, () => {
      console.log(`${color(GREEN, '✓')} ${r.link} -> ${r.target}`);
      if (!r.onPath) console.log(`${dim('·')} ${r.dir} 不在 PATH 里，加一句到 shell 配置：export PATH="${r.dir}:$PATH"`);
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
      `${bold('数据')}   brief · week [--week W] · candidates [--dispatchable] · changes [--since last-daily|last-weekly|<ts>] · commits [--since] [--limit] · velocity [--weeks] · report data [--week W]`,
      `${bold('计划')}   apply --from <plan.yaml> --confirmed（见 protocol §6）· apply --dismiss [--from <plan.yaml>]`,
      `${bold('报告')}   report write --kind daily|weekly [--week W] --from <md>|--stdin · report status · deliver notes [--kind] --from <md>|--stdin [--title] · deliver notes --probe`,
      `${bold('定时')}   job install [--daily 11:00] [--weekly 10:00] [--weekday mon] [--agent claude|codex|<路径>] · job remove · job status · job run daily|weekly [--dry-run]`,
      `${bold('视图')}   tui · status · tree · show`,
      `${bold('协议')}   protocol（打印 PROTOCOL.md，agent 先读它再写）`,
      `${bold('skill')}  skill install [--force] · remove · status · link（装进 ~/.agents/skills 与 ~/.claude/skills；运行时自动补装/更新自己装的那份，OKR_SKIP_SKILL=1 关掉；link 把 okr 软链到 ~/.local/bin）`,
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

/** Keep the shipped skill in place without a postinstall hook (npm 11 breaks git installs that have one). Notes go to stderr so --json stays clean. */
function autoSkill(): void {
  const r = ensureSkill();
  if (!r) return;
  const verb = r.action === 'installed' ? '已装到' : '已更新';
  console.error(dim(`okr skill ${verb} ${r.result.agents.path}（OKR_SKIP_SKILL=1 可关；okr skill status 查看）`));
}

function dispatch(): void {
if (flag('help')) return cmdHelp();
if (flag('version')) { console.log(PKG_VERSION); return; }
checkArgs();
if (cmd !== 'skill' && cmd !== 'demo') autoSkill();
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
  case 'brief': cmdBrief(); break;
  case 'week': cmdWeek(); break;
  case 'candidates': cmdCandidates(); break;
  case 'changes': cmdChanges(); break;
  case 'commits': cmdCommits(); break;
  case 'apply': cmdApply(); break;
  case 'report': cmdReport(); break;
  case 'deliver': cmdDeliver(); break;
  case 'job': cmdJob(); break;
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
