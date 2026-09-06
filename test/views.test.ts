import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { strip } from '../src/ansi.ts';
import { DEMO_EVENTS, DEMO_NODES, DEMO_TODAY } from '../src/demo.ts';
import { weekView } from '../src/plan.ts';
import { project, velocity } from '../src/project.ts';
import { paint, resolveFormat } from '../src/render.ts';
import { reportStatus } from '../src/report.ts';
import { deltaText, weekDelta } from '../src/views/common.ts';
import { depChain, renderDeps } from '../src/views/deps.ts';
import { mdDetail, mdStatus, mdTree, mdVelocity, mdWeek } from '../src/views/md.ts';
import { listReports, renderDoc, renderReportList, wrap } from '../src/views/reports.ts';
import { renderVelocity } from '../src/views/velocity.ts';
import { renderWeek, weekNodes } from '../src/views/week.ts';

const tree = () => project(DEMO_NODES, DEMO_EVENTS, DEMO_TODAY);

test('resolveFormat: md wins, then ansi, plain when piped or NO_COLOR; paint strips for plain', () => {
  assert.equal(resolveFormat({ md: true, isTTY: true }), 'md');
  assert.equal(resolveFormat({ ansi: true, isTTY: false }), 'ansi');
  assert.equal(resolveFormat({ isTTY: false }), 'plain');
  assert.equal(resolveFormat({ isTTY: true, noColor: true }), 'plain');
  assert.equal(resolveFormat({ isTTY: true }), 'ansi');
  assert.equal(paint(['\x1b[1mhi\x1b[22m  '], 'plain'), 'hi');
  assert.equal(paint(['\x1b[1mhi\x1b[22m'], 'ansi'), '\x1b[1mhi\x1b[22m');
});

test('week view: planned in order then carry-over, selection marks the row, throughput block present', () => {
  const t = tree();
  const w = weekView(t, DEMO_EVENTS, '/nonexistent', t.week);
  const nodes = weekNodes(w, t);
  assert.deepEqual(nodes.map((s) => s.node.id), [...w.planned, ...w.carryOver].map((f) => f.id));
  const r = renderWeek(w, t, { width: 100, selected: 1, bare: true });
  const plain = r.lines.map(strip);
  assert.ok(plain[r.selectedLine].startsWith('▸'));
  assert.ok(plain[r.selectedLine].includes(nodes[1].node.id));
  assert.ok(plain.some((l) => l.includes('遗留')));
  assert.ok(plain.some((l) => l.includes('吞吐')));
  const md = mdWeek(w, t);
  assert.equal(md[0], `# ${t.week} 本周 ${w.start} → ${w.end}`);
  assert.ok(md.includes('## 计划') && md.includes('## 遗留') && md.includes('## 吞吐'));
  assert.ok(md.some((l) => /^1\. \*\*kr1\.2\*\*/.test(l)));
});

test('velocity: bar scaled to the best week, markdown table', () => {
  const v = velocity(tree(), 4);
  const lines = renderVelocity(v, { width: 80, bare: true }).map(strip);
  assert.equal(lines.length, v.length + 1);
  assert.ok(lines[0].includes('2026-W33') && lines[0].includes('kr1.1'));
  assert.ok(lines.at(-1)!.startsWith(' 合计 1 个'));
  const md = mdVelocity(v);
  assert.equal(md[0], '| 周 | 完成 | 用时 | 任务 |');
  assert.ok(md[2].startsWith('| 2026-W33 | 1 |'));
});

test('depChain: upstream / downstream, blockedBy lists unfinished deps, transitive via', () => {
  const t = project(
    [
      { id: 'a', name: 'A', kind: 'task' },
      { id: 'b', name: 'B', kind: 'task', deps: ['a'] },
      { id: 'c', name: 'C', kind: 'task', deps: ['b', 'zz'] },
    ],
    [{ ts: '2026-09-01T10:00:00+08:00', rec: '2026-09-01T10:00:00+08:00', node: 'a', type: 'done', note: 'ok' }],
    '2026-09-03',
  );
  const c = depChain(t, t.byId.get('c')!);
  assert.deepEqual(c.upstream.map((l) => [l.id, l.depth, l.via]), [['b', 1, null], ['zz', 1, null], ['a', 2, 'b']]);
  assert.deepEqual(c.blockedBy, ['b', 'zz']);
  const a = depChain(t, t.byId.get('a')!);
  assert.deepEqual(a.downstream.map((l) => [l.id, l.depth]), [['b', 1], ['c', 2]]);
  const lines = renderDeps(t, t.byId.get('c')!, 80).map(strip);
  assert.ok(lines[0].includes('依赖链'));
  assert.ok(lines.some((l) => l.includes('← zz') && l.includes('不存在')));
  assert.ok(lines.some((l) => l.includes('▸ c') && l.includes('等 b zz')));
  assert.deepEqual(renderDeps(t, t.byId.get('a')!, 80).map(strip).filter((l) => l.includes('→')).length, 2);
});

test('weekDelta: objectives moved since Monday, tasks never', () => {
  const t = tree();
  assert.equal(weekDelta(t, t.byId.get('kr1.2')!), null);
  const d = weekDelta(t, t.byId.get('kr1')!);
  assert.ok(d !== null && d > 0);
  assert.match(deltaText(d), /^\+\d+%$/);
  assert.equal(deltaText(null), '');
});

test('markdown views: tables and nested lists, charts fenced', () => {
  const t = tree();
  const st = mdStatus(t);
  assert.equal(st[2], '| id | 目标 | 领域 | 进度 | 本周 | 健康 | 子节点 | 最近 |');
  assert.ok(st.some((l) => l.startsWith('| o1 |') && l.includes('45%')));
  const tr = mdTree(t);
  assert.ok(tr.some((l) => l.startsWith('- **o1**')));
  assert.ok(tr.some((l) => l.startsWith('    - [ ] **kr1.2**')));
  const m11 = tr.find((l) => l.includes('**m1.1**'))!;
  assert.equal((m11.match(/阻塞/g) ?? []).length, 1);
  const d = mdDetail(t.byId.get('o1')!, t, DEMO_TODAY);
  assert.equal(d[0], '# o1 推荐系统二期上线');
  assert.ok(d.includes('## 燃起') && d.includes('```') && d.includes('## 子节点') && d.includes('## 最近事件'));
  assert.ok(d.some((l) => l.startsWith('- **kr1**')), 'direct children at top level of the list');
  const task = mdDetail(t.byId.get('kr1.3')!, t, DEMO_TODAY);
  assert.ok(task.includes('## 依赖链') && task.some((l) => l.startsWith('- ← kr1.2')));
  assert.ok(task.some((l) => l === '  1. 序列特征在训练集覆盖率 > 90%'));
});

test('reports: listing classifies and orders newest first, list view and doc renderer', () => {
  const dir = mkdtempSync(join(tmpdir(), 'okr-views-'));
  try {
    const reports = join(dir, 'reports');
    const logs = join(dir, 'logs');
    mkdirSync(reports);
    mkdirSync(logs);
    writeFileSync(join(reports, '2026-W35.md'), '# w35');
    writeFileSync(join(reports, '2026-W36.md'), '# w36');
    writeFileSync(join(reports, '2026-W36.plan.yaml'), 'week: 2026-W36');
    writeFileSync(join(reports, '2026-W36.plan-2.yaml'), 'week: 2026-W36');
    writeFileSync(join(reports, 'notes.md'), 'x');
    writeFileSync(join(reports, 'junk.txt'), 'x');
    writeFileSync(join(logs, '2026-09-02.daily.md'), '# d');
    writeFileSync(join(logs, 'daily.log'), 'x');
    const list = listReports(reports, logs);
    assert.deepEqual(
      list.map((e) => [e.kind, e.file]),
      [
        ['other', 'notes.md'],
        ['daily', '2026-09-02.daily.md'],
        ['weekly', '2026-W36.md'],
        ['plan', '2026-W36.plan-2.yaml'],
        ['plan', '2026-W36.plan.yaml'],
        ['weekly', '2026-W35.md'],
      ],
    );
    const st = reportStatus([], '2026-09-03', '2026-W36');
    const r = renderReportList(list, st, { width: 80, selected: 2, bare: true });
    const plain = r.lines.map(strip);
    assert.ok(plain[0].includes('还没写过'));
    assert.ok(plain[r.selectedLine].startsWith('▸') && plain[r.selectedLine].includes('2026-W36.md'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  const doc = renderDoc('# 标题\n\n- 一条\n- 二条 **重点** `code`\n\n> 引用\n\n```\nraw\n```\n---\n正文', { width: 40 }).map(strip);
  assert.equal(doc[0], ' 标题');
  assert.ok(doc.some((l) => l === ' • 一条'));
  assert.ok(doc.some((l) => l === ' • 二条 重点 code'));
  assert.ok(doc.some((l) => l === ' │ 引用'));
  assert.ok(doc.some((l) => l === ' raw'));
  assert.deepEqual(wrap('一二三四五六', 4), ['一二', '三四', '五六']);
  assert.deepEqual(wrap('short', 10), ['short']);
});
