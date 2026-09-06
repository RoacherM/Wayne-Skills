import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { project } from '../src/project.ts';
import { applyPlan, brief, candidates, changes, PlanError, proposalFiles, proposalStatus, repoCommits, reportData, resolveSince, weekView } from '../src/plan.ts';
import type { Event, Node } from '../src/types.ts';

const T = (d: string, h = 10) => `${d}T${String(h).padStart(2, '0')}:00:00+08:00`;
const ev = (node: string | null, type: Event['type'], d: string, extra: Partial<Event> = {}): Event => ({ ts: T(d), rec: T(d), node, type, note: extra.note ?? type, ...extra });
const TODAY = '2026-09-03'; // 2026-W36, Thursday

const spec = { goal: 'g', accept: ['a'], verify: 'v', links: ['l'] };
const NODES: Node[] = [
  { id: 'o1', name: '目标', kind: 'objective', start: '2026-08-01', end: '2026-09-15' },
  { id: 'kr1', name: '精度', kind: 'metric', parent: 'o1', unit: '%', from: 70, to: 90, start: '2026-08-01', end: '2026-09-15' },
  { id: 'kr1.1', name: '上周排的', kind: 'task', parent: 'kr1', priority: 'P1', deadline: '2026-09-02', week: '2026-W35', order: 1, spec },
  { id: 'kr1.2', name: '本周排的', kind: 'task', parent: 'kr1', priority: 'P2', week: '2026-W36', order: 1, deps: ['kr1.1'] },
  { id: 'kr1.3', name: '早就完成', kind: 'task', parent: 'kr1', week: '2026-W34', order: 1 },
  { id: 't1', name: '零散', kind: 'task', priority: 'P0', deadline: '2026-09-05', spec },
  { id: 'h1', name: '晨跑', kind: 'habit', cadence: '3/week' },
];
const EVENTS: Event[] = [
  ev('kr1', 'progress', '2026-08-20', { value: 75 }),
  ev('kr1.3', 'done', '2026-08-25'),
  ev('kr1', 'progress', '2026-09-01', { value: 80 }),
  ev('kr1.1', 'blocked', '2026-09-01', { note: '等接口' }),
  ev(null, 'report', '2026-09-01', { kind: 'daily', rec: T('2026-09-01', 22) }),
  ev('t1', 'progress', '2026-09-02', { note: '开工' }),
  ev('t1', 'progress', '2026-08-30', { note: '补记', rec: T('2026-09-02', 9) }),
  ev('h1', 'check', '2026-09-02'),
];
const tree = (nodes = NODES, events = EVENTS, today = TODAY) => project(nodes, events, today);
const reportsDir = () => {
  const d = join(mkdtempSync(join(tmpdir(), 'okr-plan-')), 'reports');
  mkdirSync(d);
  return d;
};

test('weekView: planned by order, carry-over is unfinished tasks from earlier weeks', () => {
  const w = weekView(tree(), EVENTS, reportsDir());
  assert.equal(w.week, '2026-W36');
  assert.equal(w.start, '2026-08-31');
  assert.equal(w.end, '2026-09-06');
  assert.deepEqual(w.planned.map((f) => f.id), ['kr1.2']);
  assert.deepEqual(w.carryOver.map((f) => [f.id, f.week]), [['kr1.1', '2026-W35']]); // kr1.3 is done, not carried
  assert.equal(w.proposal, 'none');
  const prev = weekView(tree(), EVENTS, reportsDir(), '2026-W35');
  assert.deepEqual(prev.planned.map((f) => f.id), ['kr1.1']);
  assert.deepEqual(prev.carryOver.map((f) => f.id), []); // kr1.3 (W34) was done
  assert.equal(prev.current, false);
});

test('proposalFiles: pending until a plan event names the file; dismissed / applied by the latest one', () => {
  const dir = reportsDir();
  for (const f of ['2026-W36.plan.yaml', '2026-W36.plan-2.yaml', '2026-W35.plan.yaml', 'notes.md']) writeFileSync(join(dir, f), 'week: x\n');
  assert.equal(proposalStatus(proposalFiles(dir, '2026-W36', [])), 'pending');
  const applied = [ev(null, 'plan', '2026-09-01', { source: '2026-W36.plan.yaml' })];
  let files = proposalFiles(dir, '2026-W36', applied);
  assert.deepEqual(files.map((f) => [f.file, f.status]), [['2026-W36.plan-2.yaml', 'pending'], ['2026-W36.plan.yaml', 'applied']]);
  assert.equal(proposalStatus(files), 'pending');
  files = proposalFiles(dir, '2026-W36', [...applied, ev(null, 'plan', '2026-09-02', { source: '2026-W36.plan-2.yaml', dismissed: true })]);
  assert.equal(proposalStatus(files), 'applied');
  assert.equal(proposalStatus(proposalFiles(dir, '2026-W35', [ev(null, 'plan', '2026-08-25', { source: '2026-W35.plan.yaml', dismissed: true })])), 'dismissed');
  assert.equal(proposalStatus(proposalFiles(dir, '2026-W37', [])), 'none');
  assert.equal(proposalStatus(proposalFiles(join(dir, 'missing'), '2026-W36', [])), 'none');
});

test('brief: buckets by flag, upper nodes behind, pending proposals, empty flag', () => {
  const dir = reportsDir();
  writeFileSync(join(dir, '2026-W36.plan.yaml'), 'plan: []\n');
  const b = brief(tree(), EVENTS, dir);
  assert.deepEqual(b.overdue.map((f) => f.id), ['kr1.1']);
  assert.deepEqual(b.blocked.map((f) => f.id), ['kr1.1']);
  assert.deepEqual(b.dueSoon.map((f) => f.id), ['t1']);
  assert.deepEqual(b.proposals.map((f) => f.file), ['2026-W36.plan.yaml']);
  assert.ok(b.behind.some((u) => u.id === 'kr1' && u.health === 'at-risk'), 'kr1 at 50% with 73% elapsed is at risk');
  assert.equal(b.empty, false);
  const quiet = brief(tree([{ id: 'o9', name: 'x', kind: 'objective', start: '2026-09-01', end: '2026-12-31' }], [ev('o9', 'progress', '2026-09-02')], TODAY), [], reportsDir());
  assert.equal(quiet.empty, true);
});

test('candidates: unfinished active tasks with upper gap, deps and spec facts; --dispatchable filters', () => {
  const c = candidates(tree());
  assert.deepEqual(c.map((x) => x.id), ['t1', 'kr1.1', 'kr1.2']); // priority, then deadline, then id; kr1.3 done
  const kr12 = c.find((x) => x.id === 'kr1.2')!;
  assert.equal(kr12.upper?.id, 'kr1');
  assert.ok(kr12.upper!.gap! < 0);
  assert.deepEqual(kr12.deps, [{ id: 'kr1.1', name: '上周排的', done: false }]);
  assert.equal(kr12.depsOpen, 1);
  assert.deepEqual(kr12.specMissing, ['goal', 'accept', 'verify', 'links']);
  assert.equal(kr12.dispatchable, false);
  assert.deepEqual(c.find((x) => x.id === 'kr1.1')!.dependents, ['kr1.2']);
  assert.equal(c.find((x) => x.id === 'kr1.1')!.carryOver, true);
  assert.deepEqual(candidates(tree(), { dispatchable: true }).map((x) => x.id), ['t1', 'kr1.1']); // spec + deps decide; blocked is a flag, not a filter
});

test('resolveSince / changes: report anchors use rec; bare dates start at midnight; plan and report events excluded', () => {
  const daily = resolveSince(EVENTS, 'last-daily')!;
  assert.equal(daily.since, T('2026-09-01', 22));
  assert.equal(daily.anchor?.type, 'report');
  const weekly = resolveSince(EVENTS, 'last-weekly')!;
  assert.equal(weekly.since, null);
  assert.equal(resolveSince(EVENTS, 'nope'), null);
  assert.match(resolveSince(EVENTS, '2026-09-02')!.since!, /^2026-09-02T00:00:00/);
  assert.equal(resolveSince(EVENTS, '2026-09-02T08:00:00+08:00')!.since, '2026-09-02T08:00:00+08:00');
  const rows = changes(EVENTS, daily.since);
  // the back-dated 08-30 entry shows up because it was recorded on 09-02; newest first
  assert.deepEqual(rows.map((e) => [e.node, e.ts.slice(0, 10)]), [['h1', '2026-09-02'], ['t1', '2026-09-02'], ['t1', '2026-08-30']]);
  assert.equal(changes(EVENTS, null).length, EVENTS.length - 1);
});

test('repoCommits: parses git output, reports missing dirs and non-repos', () => {
  const dir = mkdtempSync(join(tmpdir(), 'okr-repo-'));
  const run = (path: string, since: string | null, limit: number) => {
    assert.equal(since, '2026-09-01T00:00:00+08:00');
    assert.equal(limit, 5);
    return `abc1234\x1fWayne\x1f2026-09-02T10:00:00+08:00\x1ffeat: one\nabc1235\x1fWayne\x1f2026-09-01T10:00:00+08:00\x1ffix: two\n`;
  };
  mkdirSync(join(dir, '.git'));
  const out = repoCommits([{ path: dir, node: 'kr1' }, { path: join(dir, 'nope') }, { path: tmpdir() }], '2026-09-01T00:00:00+08:00', 5, run);
  assert.equal(out[0].commits.length, 2);
  assert.deepEqual(out[0].commits[0], { hash: 'abc1234', author: 'Wayne', date: '2026-09-02T10:00:00+08:00', subject: 'feat: one' });
  assert.equal(out[0].node, 'kr1');
  assert.equal(out[1].error, '目录不存在');
  assert.equal(out[2].error, '不是 git 仓库');
});

test('applyPlan: new nodes with new:N refs, plan sets week + order, drop clears, carry-over must be decided', () => {
  const t = tree();
  assert.throws(() => applyPlan(NODES, EVENTS, t, { plan: ['kr1.2'] }), (e: PlanError) => e.code === 3 && e.extra.carryOver!.toString() === 'kr1.1');
  const r = applyPlan(NODES, EVENTS, t, {
    week: '2026-W36',
    new: [
      { id: 'kr1.9', parent: 'kr1', name: '新任务', priority: 'P1', deadline: '2026-09-05', spec },
      { parent: 'kr1', name: '跟进', deps: ['new:0', 'kr1.2'] },
    ],
    plan: ['t1', 'new:0', 'new:1'],
    drop: ['kr1.1'],
  });
  assert.deepEqual(r.created.map((n) => n.id), ['kr1.9', 'kr1.4']);
  assert.deepEqual(r.created[1].deps, ['kr1.9', 'kr1.2']);
  assert.deepEqual(r.planned.map((p) => [p.id, p.order]), [['t1', 2], ['kr1.9', 3], ['kr1.4', 4]]); // kr1.2 kept order 1
  assert.deepEqual(r.kept, ['kr1.2']);
  assert.deepEqual(r.dropped, [{ id: 'kr1.1', before: '2026-W35' }]);
  const by = new Map(r.nodes.map((n) => [n.id, n]));
  assert.equal(by.get('kr1.1')!.week, undefined);
  assert.equal(by.get('kr1.1')!.order, undefined);
  assert.equal(by.get('t1')!.week, '2026-W36');
  assert.ok(r.warnings.some((w) => w.startsWith('kr1.4 spec 缺')));
  assert.ok(!r.warnings.some((w) => w.startsWith('kr1.9')));
  assert.deepEqual(r.notes.map((n) => n.id), ['t1', 'kr1.1']); // created nodes get their own add event, kept ones nothing
  assert.equal(NODES.find((n) => n.id === 't1')!.week, undefined, 'input untouched');
});

test('applyPlan: re-apply in the same week keeps unlisted orders and appends listed ones', () => {
  const nodes: Node[] = [
    { id: 'a', name: 'a', kind: 'task', week: '2026-W36', order: 1 },
    { id: 'b', name: 'b', kind: 'task', week: '2026-W36', order: 2 },
    { id: 'c', name: 'c', kind: 'task', week: '2026-W36', order: 3 },
    { id: 'd', name: 'd', kind: 'task' },
  ];
  const r = applyPlan(nodes, [], tree(nodes, []), { plan: ['d', 'a'] });
  assert.deepEqual(r.kept, ['b', 'c']);
  assert.deepEqual(r.planned.map((p) => [p.id, p.order]), [['d', 4], ['a', 5]]);
  assert.deepEqual(r.notes.map((n) => n.note), ['edit d: week: none → 2026-W36; order: none → 4', 'edit a: order: 1 → 5']);
});

test('applyPlan: rejects bad input', () => {
  const t = tree();
  const bad = (file: Parameters<typeof applyPlan>[3], re: RegExp, code = 1) =>
    assert.throws(() => applyPlan(NODES, EVENTS, t, file), (e: PlanError) => e instanceof PlanError && e.code === code && re.test(e.message));
  bad({}, /没事可做/);
  bad({ week: 'W36', plan: ['t1'] }, /week 格式/);
  bad({ plan: ['t1'], drop: ['kr1.1'], extra: 1 } as never, /不认识的字段/);
  bad({ plan: ['nope'], drop: ['kr1.1'] }, /不存在/);
  bad({ plan: ['kr1'], drop: ['kr1.1'] }, /只有 task/, 3);
  bad({ plan: ['kr1.3'], drop: ['kr1.1'] }, /已完成/, 3);
  bad({ plan: ['t1', 't1'], drop: ['kr1.1'] }, /出现了两次/);
  bad({ plan: ['t1'], drop: ['t1', 'kr1.1'] }, /同时在/);
  bad({ new: [{ name: 'x', parent: 'nope' }], plan: ['new:0'], drop: ['kr1.1'] }, /parent 不存在/);
  bad({ new: [{ name: 'x', id: 't1' }], plan: ['new:0'], drop: ['kr1.1'] }, /已存在/);
  bad({ new: [{ name: 'x', id: 'kr1.3' }], plan: ['new:0'], drop: ['kr1.1'] }, /已存在/);
  bad({ new: [{ name: 'x' }], plan: ['new:1'], drop: ['kr1.1'] }, /new 只有 1 项/);
  bad({ new: [{ name: 'x', parent: 'new:0' }], plan: ['new:0'], drop: ['kr1.1'] }, /排在它前面/);
  bad({ new: [{ name: 'x', kind: 'metric' }], drop: ['kr1.1'] }, /metric 需要/);
  bad({ new: [{ name: 'x', priority: 'P9' as never }], drop: ['kr1.1'] }, /P0–P3/);
  bad({ new: [{ name: 'x', kind: 'objective', priority: 'P1' }], drop: ['kr1.1'] }, /只对 task/);
  // a frozen task cannot be planned
  const frozen = NODES.map((n) => (n.id === 't1' ? { ...n, status: 'frozen' as const } : n));
  assert.throws(() => applyPlan(frozen, EVENTS, tree(frozen), { plan: ['t1'], drop: ['kr1.1'] }), /已冻结/);
});

test('reportData: progress delta over the week, done tasks, event counts, habits', () => {
  const events = [...EVENTS, ev('kr1.2', 'done', '2026-09-02', { hours: 3 })];
  const r = reportData(tree(NODES, events), events, reportsDir());
  assert.equal(r.week, '2026-W36');
  const kr1 = r.nodes.find((n) => n.id === 'kr1')!;
  assert.equal(kr1.before, 0.25); // 75 of 70→90 as of 08-30
  assert.equal(kr1.progress, 0.5);
  assert.equal(kr1.delta, 0.25);
  assert.equal(kr1.current, 80);
  assert.deepEqual(r.done.map((d) => [d.id, d.hours]), [['kr1.2', 3]]);
  assert.equal(r.events.progress, 2); // kr1 09-01, t1 09-02; the back-dated 08-30 one is outside the week by ts
  assert.equal(r.events.report, 1);
  assert.equal(r.habits[0].checksInWeek, 1);
  assert.equal(r.plan.planned.length, 1);
  assert.equal(r.candidates.length, 2);
  const prev = reportData(tree(NODES, events), events, reportsDir(), '2026-W35');
  assert.equal(prev.current, false);
  assert.deepEqual(prev.done.map((d) => d.id), ['kr1.3']); // done 08-25 falls in W35
});
