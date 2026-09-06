import assert from 'node:assert/strict';
import { test } from 'node:test';
import { weekLabel, weekMonday, parseTs, daysBetween, sortEvents } from '../src/dates.ts';
import { project, stageOf, parseCadence, newId, takenIds, velocity, matchNode } from '../src/project.ts';
import { validateData } from '../src/validate.ts';
import { DEMO_EVENTS, DEMO_NODES, DEMO_TODAY } from './fixture.ts';
import type { Event, Node } from '../src/types.ts';

const T = (d: string, h = 10) => `${d}T${String(h).padStart(2, '0')}:00:00+08:00`;
const ev = (node: string | null, type: Event['type'], d: string, extra: Partial<Event> = {}): Event => ({
  ts: T(d),
  rec: T(d),
  node,
  type,
  note: extra.note ?? type,
  ...extra,
});

test('weekLabel: ISO week with Thursday rule', () => {
  assert.equal(weekLabel('2026-09-03'), '2026-W36');
  assert.equal(weekLabel('2026-01-01'), '2026-W01');
  assert.equal(weekLabel('2026-12-31'), '2026-W53');
  assert.equal(weekLabel('2027-01-03'), '2026-W53');
  assert.equal(weekMonday('2026-W36'), '2026-08-31');
  assert.equal(weekMonday('2026-W99'), null);
});

test('parseTs: date becomes local noon, ISO passes through', () => {
  assert.match(parseTs('2026-09-03')!, /^2026-09-03T12:00:00[+-]\d\d:\d\d$/);
  assert.equal(parseTs('2026-09-03T08:00:00+08:00'), '2026-09-03T08:00:00+08:00');
  assert.equal(parseTs('nope'), null);
  assert.equal(daysBetween('2026-09-01T23:00:00+08:00', '2026-09-03'), 2);
});

test('stageOf: order of events decides, including same-second sequences', () => {
  const s = (types: Event['type'][]) => stageOf(types.map((t) => ev('x', t, '2026-09-01')));
  assert.equal(s([]), 'todo');
  assert.equal(s(['progress']), 'doing');
  assert.equal(s(['claim', 'blocked']), 'blocked');
  assert.equal(s(['blocked', 'progress']), 'doing');
  assert.equal(s(['submit']), 'review');
  assert.equal(s(['submit', 'progress']), 'review');
  assert.equal(s(['submit', 'reject']), 'doing');
  assert.equal(s(['submit', 'reject', 'done']), 'done');
  assert.equal(s(['done', 'reject']), 'doing');
  assert.equal(s(['done', 'reject', 'submit']), 'review');
});

test('progress: task / metric / milestone / objective recursion and null for undecomposed', () => {
  const nodes: Node[] = [
    { id: 'o', name: 'o', kind: 'objective', start: '2026-07-01', end: '2026-09-30' },
    { id: 'kr', name: 'kr', kind: 'metric', parent: 'o', unit: '%', from: 76, to: 95, weight: 2 },
    { id: 'm', name: 'm', kind: 'milestone', parent: 'o' },
    { id: 'm.1', name: 'a', kind: 'task', parent: 'm' },
    { id: 'm.2', name: 'b', kind: 'task', parent: 'm' },
    { id: 'm.3', name: 'c', kind: 'task', parent: 'm', status: 'canceled' },
    { id: 'empty', name: 'e', kind: 'milestone', parent: 'o' },
  ];
  const events = [
    ev('kr', 'progress', '2026-08-01', { value: 85.5 }),
    ev('m.1', 'done', '2026-08-02'),
    ev('m.2', 'submit', '2026-08-03', { links: ['pr'] }),
  ];
  const t = project(nodes, events, '2026-09-03');
  const g = (id: string) => t.byId.get(id)!;
  assert.equal(g('kr').progress, 0.5);
  assert.equal(g('m.1').progress, 1);
  assert.equal(g('m.2').progress, 0.5);
  assert.equal(g('m').progress, 0.75);
  assert.equal(g('empty').progress, null);
  assert.equal(g('o').undecomposed, 1, 'one child without progress');
  // objective: kr weight 2 (0.5), m weight 1 (0.75); empty excluded
  assert.equal(g('o').progress, (0.5 * 2 + 0.75) / 3);
  assert.equal(g('m.3').health, 'canceled');
  // metric progress uses latest value, clamped
  const t2 = project(nodes, [ev('kr', 'progress', '2026-08-05', { value: 120 })], '2026-09-03');
  assert.equal(t2.byId.get('kr')!.progress, 1);
});

test('assess: overrides derived until a done / reject / submit / change lands in the subtree', () => {
  const nodes: Node[] = [
    { id: 'o', name: 'o', kind: 'objective', start: '2026-07-01', end: '2026-09-30' },
    { id: 'm', name: 'm', kind: 'milestone', parent: 'o' },
    { id: 'm.1', name: 'a', kind: 'task', parent: 'm' },
    { id: 'm.2', name: 'b', kind: 'task', parent: 'm' },
  ];
  const base = [ev('m.1', 'done', '2026-08-02'), ev('o', 'assess', '2026-08-10', { value: 70, derived: 50, note: 'reason' })];
  let s = project(nodes, base, '2026-09-03').byId.get('o')!;
  assert.equal(s.derived, 0.5);
  assert.equal(s.assess?.value, 0.7);
  assert.equal(s.assess?.stale, false);
  assert.equal(s.progress, 0.7);
  // progress / claim / check do not invalidate
  s = project(nodes, [...base, ev('m.2', 'progress', '2026-08-12'), ev('m.2', 'claim', '2026-08-13', { by: 'x' })], '2026-09-03').byId.get('o')!;
  assert.equal(s.assess?.stale, false);
  // done does
  s = project(nodes, [...base, ev('m.2', 'done', '2026-08-15')], '2026-09-03').byId.get('o')!;
  assert.equal(s.assess?.stale, true);
  assert.equal(s.progress, 1);
  // change does
  s = project(nodes, [...base, ev('m.2', 'change', '2026-08-15')], '2026-09-03').byId.get('o')!;
  assert.equal(s.assess?.stale, true);
  assert.equal(s.progress, 0.5);
});

test('task: planned, carry-over, dispatchable, flags', () => {
  const spec = { goal: 'g', accept: ['a'], verify: 'v', links: ['l'] };
  const nodes: Node[] = [
    { id: 'a', name: 'a', kind: 'task', week: '2026-W36', spec, deadline: '2026-09-04' },
    { id: 'b', name: 'b', kind: 'task', week: '2026-W35', spec, deps: ['a'] },
    { id: 'c', name: 'c', kind: 'task', week: '2026-W35' },
    { id: 'd', name: 'd', kind: 'task', week: '2026-W34', spec, deps: ['c'] },
    { id: 'e', name: 'e', kind: 'task', spec, deadline: '2026-08-30' },
    { id: 'f', name: 'f', kind: 'task', spec },
  ];
  const events = [
    ev('c', 'done', '2026-08-28'),
    ev('e', 'progress', '2026-08-20'),
    ev('f', 'submit', '2026-08-28', { links: ['pr'] }),
  ];
  const t = project(nodes, events, '2026-09-03');
  const g = (id: string) => t.byId.get(id)!;
  assert.equal(g('a').planned, true);
  assert.equal(g('a').carryOver, false);
  assert.equal(g('a').dispatchable, true);
  assert.ok(g('a').flags.includes('due-soon'));
  assert.equal(g('b').planned, false);
  assert.equal(g('b').carryOver, true);
  assert.equal(g('b').dispatchable, false, 'dep a not done');
  assert.equal(g('c').carryOver, false, 'done tasks never carry over');
  assert.equal(g('d').dispatchable, true, 'dep c is done');
  assert.ok(g('e').flags.includes('overdue'));
  assert.ok(g('e').flags.includes('stale'));
  assert.equal(g('e').health, 'behind');
  assert.equal(g('f').stage, 'review');
  assert.ok(g('f').flags.includes('review-stale'));
  assert.equal(g('f').health, 'idle');
});

test('claim holder: released by submit / reject / done, kept across progress', () => {
  const nodes: Node[] = [{ id: 't', name: 't', kind: 'task' }];
  const holder = (events: Event[]) => project(nodes, events, '2026-09-03').byId.get('t')!.claimed;
  const claim = ev('t', 'claim', '2026-09-01', { by: 'codex', session: 'wt1' });
  assert.deepEqual(holder([claim])?.by, 'codex');
  assert.equal(holder([claim, ev('t', 'progress', '2026-09-02')])?.session, 'wt1');
  assert.equal(holder([claim, ev('t', 'submit', '2026-09-02', { links: ['pr'] })]), null);
  assert.equal(holder([claim, ev('t', 'done', '2026-09-02')]), null);
});

test('habit: cadence parsing, period counting, health', () => {
  assert.deepEqual(parseCadence('3/week'), { times: 3, period: 'week' });
  assert.deepEqual(parseCadence('daily'), { times: 1, period: 'day' });
  assert.deepEqual(parseCadence('10/month'), { times: 10, period: 'month' });
  assert.equal(parseCadence('sometimes'), null);
  const nodes: Node[] = [{ id: 'h', name: 'h', kind: 'habit', cadence: '3/week', start: '2026-08-17' }];
  const checks = ['2026-08-17', '2026-08-19', '2026-08-21', '2026-08-25', '2026-08-26', '2026-08-28', '2026-08-31'].map((d) => ev('h', 'check', d));
  // Thursday 2026-09-03: 1 check this week, 2 more needed, 4 days left → on track
  let s = project(nodes, checks, '2026-09-03').byId.get('h')!;
  assert.equal(s.habit?.thisPeriod, 1);
  assert.equal(s.habit?.streak, 2, 'two full previous weeks met');
  assert.equal(s.habit?.total, 7);
  assert.equal(s.health, 'on-track');
  // Sunday 2026-09-06 with only 1 check: needs 2 in 1 day → behind
  s = project(nodes, checks, '2026-09-06').byId.get('h')!;
  assert.equal(s.health, 'behind');
});

test('upper health: gap between progress and elapsed, idle after 14 quiet days', () => {
  const nodes: Node[] = [
    { id: 'o', name: 'o', kind: 'objective', start: '2026-07-01', end: '2026-09-30' },
    { id: 'm', name: 'm', kind: 'milestone', parent: 'o' },
    { id: 'm.1', name: 'a', kind: 'task', parent: 'm' },
    { id: 'm.2', name: 'b', kind: 'task', parent: 'm' },
  ];
  // elapsed on 2026-09-03 ≈ 64/91 ≈ 0.70; progress 0.5 → gap −0.2 → at-risk
  let s = project(nodes, [ev('m.1', 'done', '2026-09-01')], '2026-09-03').byId.get('o')!;
  assert.equal(s.health, 'at-risk');
  // progress 0 → behind
  s = project(nodes, [ev('m.1', 'progress', '2026-09-01')], '2026-09-03').byId.get('o')!;
  assert.equal(s.health, 'behind');
  // 14 days without any event in the subtree → idle
  s = project(nodes, [ev('m.1', 'done', '2026-08-01')], '2026-09-03').byId.get('o')!;
  assert.equal(s.health, 'idle');
});

test('newId and matchNode', () => {
  const nodes: Node[] = [
    { id: 'o1', name: '推荐系统', kind: 'objective' },
    { id: 'o1.1', name: 'x', kind: 'task', parent: 'o1' },
    { id: 'kr1', name: '模型精度', kind: 'metric' },
  ];
  assert.equal(newId(nodes, 'task', 'o1'), 'o1.2');
  assert.equal(newId(nodes, 'metric', null), 'kr2');
  assert.equal(newId(nodes, 'objective', null), 'o2');
  assert.equal(matchNode(nodes, 'kr1').node?.id, 'kr1');
  assert.equal(matchNode(nodes, '精度').node?.id, 'kr1');
  assert.equal(matchNode(nodes, 'zzz').node, undefined);
});

test('velocity: done per ISO week with user-stated hours', () => {
  const nodes: Node[] = [
    { id: 'a', name: 'a', kind: 'task' },
    { id: 'b', name: 'b', kind: 'task' },
  ];
  const t = project(nodes, [ev('a', 'done', '2026-08-25', { hours: 2 }), ev('b', 'done', '2026-08-26')], '2026-09-03');
  const v = velocity(t, 2);
  assert.deepEqual(
    v.map((w) => [w.week, w.done, w.hours]),
    [
      ['2026-W35', 2, 2],
      ['2026-W36', 0, null],
    ],
  );
});

test('validateData: catches structural problems, demo data is clean', () => {
  const r = validateData(DEMO_NODES, DEMO_EVENTS);
  assert.deepEqual(r.errors, []);
  const bad = validateData(
    [
      { id: 'a', name: 'a', kind: 'task', parent: 'b', deps: ['a', 'zz'], week: '2026-36' },
      { id: 'b', name: 'b', kind: 'task', parent: 'a' },
      { id: 'kr', name: 'kr', kind: 'metric', from: 1, to: 1 },
    ],
    [ev('nope', 'progress', '2026-09-01'), ev('kr', 'submit', '2026-09-01'), ev(null, 'plan', '2026-09-01')],
  );
  for (const needle of ['依赖自己', '依赖不存在', 'week 非法', '祖先链成环', 'from 与 to 相等', 'node 不存在: nope', 'submit 缺 links'])
    assert.ok(bad.errors.some((e) => e.includes(needle)), needle);
});

test('sortEvents: orders by instant across offsets, not by ts string', () => {
  const a = ev('x', 'progress', '2026-09-01', { ts: '2026-09-01T23:00:00+08:00', rec: '2026-09-01T23:00:00+08:00' });
  const b = ev('x', 'progress', '2026-09-01', { ts: '2026-09-01T16:00:00Z', rec: '2026-09-01T16:00:00Z' }); // = 2026-09-02T00:00:00+08:00, later
  const c = ev('x', 'progress', '2026-09-01', { ts: '2026-09-01T10:00:00-05:00', rec: '2026-09-01T10:00:00-05:00' }); // = 2026-09-01T23:00:00+08:00, ties a, keeps order
  const sorted = sortEvents([b, a, c]);
  assert.deepEqual(sorted, [a, c, b]);
});

test('effective status: frozen / canceled inherited by the whole subtree', () => {
  const nodes: Node[] = [
    { id: 'o', name: 'o', kind: 'objective', start: '2026-07-01', end: '2026-09-30', status: 'frozen' },
    { id: 'm', name: 'm', kind: 'milestone', parent: 'o' },
    { id: 't', name: 't', kind: 'task', parent: 'm', spec: { goal: 'g', accept: ['a'], verify: 'v', links: ['l'] } },
  ];
  const t = project(nodes, [], '2026-09-03');
  const g = (id: string) => t.byId.get(id)!;
  assert.equal(g('o').effective, 'frozen');
  assert.equal(g('m').effective, 'frozen', 'inherited from o even though m itself is active');
  assert.equal(g('t').effective, 'frozen');
  assert.equal(g('t').health, 'frozen');
  assert.equal(g('t').dispatchable, false, 'frozen subtree is never dispatchable');
  // canceled wins over frozen when both appear in the chain
  const nodes2: Node[] = [
    { id: 'o', name: 'o', kind: 'objective', start: '2026-07-01', end: '2026-09-30', status: 'canceled' },
    { id: 'm', name: 'm', kind: 'milestone', parent: 'o', status: 'frozen' },
  ];
  assert.equal(project(nodes2, [], '2026-09-03').byId.get('m')!.effective, 'canceled');
});

test('deps cycle: validateData reports it instead of leaving tasks permanently non-dispatchable', () => {
  const nodes: Node[] = [
    { id: 'a', name: 'a', kind: 'task', deps: ['b'] },
    { id: 'b', name: 'b', kind: 'task', deps: ['c'] },
    { id: 'c', name: 'c', kind: 'task', deps: ['a'] },
  ];
  const r = validateData(nodes, []);
  assert.ok(r.errors.some((e) => e.includes('依赖成环')), r.errors.join('\n'));
});

test('newId: ids named only in events or deps still count as taken', () => {
  const nodes: Node[] = [{ id: 'o1', name: 'o', kind: 'objective' }];
  const events: Event[] = [ev('t1', 'change', '2026-08-01', { note: 'rm t1' })]; // t1 was removed but its history remains
  assert.equal(newId(nodes, 'task', null, events), 't2');
  const nodes2: Node[] = [
    { id: 'o1', name: 'o', kind: 'objective' },
    { id: 't2', name: 't', kind: 'task', deps: ['t1'] }, // t1 doesn't exist as a node but is named in another task's deps
  ];
  assert.equal(newId(nodes2, 'task', null, []), 't3');
  // the same set answers "may this explicit id be used", so a removed node's id is refused by add as well
  const taken = takenIds(nodes2, events);
  assert.ok(taken.has('t1') && taken.has('t2') && taken.has('o1'));
  assert.ok(!taken.has('t3'));
});

test('habit health: a daily habit goes behind only once a day is actually missed', () => {
  const nodes: Node[] = [{ id: 'h', name: 'h', kind: 'habit', cadence: 'daily', start: '2026-09-01' }];
  const checked = [ev('h', 'check', '2026-09-01'), ev('h', 'check', '2026-09-02')];
  // today unchecked yet, yesterday was checked → still on track, the day isn't over
  assert.equal(project(nodes, checked, '2026-09-03').byId.get('h')!.health, 'on-track');
  // yesterday (09-02) never got checked, and today's still open → behind
  const missedYesterday = [ev('h', 'check', '2026-09-01')];
  assert.equal(project(nodes, missedYesterday, '2026-09-03').byId.get('h')!.health, 'behind');
});

test('demo tree renders the documented state', () => {
  const t = project(DEMO_NODES, DEMO_EVENTS, DEMO_TODAY);
  assert.equal(t.week, '2026-W36');
  const g = (id: string) => t.byId.get(id)!;
  assert.equal(g('kr1.1').stage, 'done');
  assert.equal(g('kr1.2').stage, 'review');
  assert.equal(g('kr1.2').claimed, null, 'submit releases the claim');
  assert.equal(g('kr1.2').flags.includes('review-stale'), false, 'submitted 3 days ago, threshold is >3');
  assert.equal(g('m1.1').stage, 'blocked');
  assert.equal(g('o1').assess?.value, 0.45);
  assert.equal(g('o0').health, 'canceled');
});
