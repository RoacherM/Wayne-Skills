import assert from 'node:assert/strict';
import { test } from 'node:test';
import { agentCommand, dailyPrompt, existingReport, mdToHtml, nextPlanFile, normalizePlanWeek, notesBody, parseTime, parseWeekday, plistXml, reportFile, reportStatus, splitWeekly, weeklyPrompt } from '../src/report.ts';
import type { Event } from '../src/types.ts';

const T = (d: string, h = 10) => `${d}T${String(h).padStart(2, '0')}:00:00+08:00`;
const rep = (d: string, kind: 'daily' | 'weekly', extra: Partial<Event> = {}): Event => ({ ts: T(d, 11), rec: T(d, 11), node: null, type: 'report', note: kind, kind, ...extra });

test('reportStatus: one report event per day / per week, week field wins over the date', () => {
  const events: Event[] = [
    rep('2026-09-01', 'daily'),
    rep('2026-09-03', 'daily'),
    rep('2026-08-31', 'weekly', { week: '2026-W36' }),
    rep('2026-08-24', 'weekly'), // no week field: derived from the date → W35
    { ts: T('2026-09-03'), rec: T('2026-09-03'), node: 't1', type: 'progress', note: 'x' },
  ];
  const s = reportStatus(events, '2026-09-03', '2026-W36');
  assert.equal(s.daily.today?.ts, T('2026-09-03', 11));
  assert.equal(s.daily.last?.ts, T('2026-09-03', 11));
  assert.equal(s.weekly.thisWeek?.week, '2026-W36');
  assert.equal(existingReport(events, 'weekly', '2026-W35')?.ts, T('2026-08-24', 11));
  assert.equal(existingReport(events, 'daily', '2026-09-02'), null);
  assert.equal(reportStatus(events, '2026-09-04', '2026-W37').daily.today, null);
  assert.equal(reportStatus(events, '2026-09-04', '2026-W37').weekly.thisWeek, null);
  assert.equal(reportFile('2026-W36'), '2026-W36.md');
});

test('mdToHtml: headings, lists, code, inline marks; html is escaped', () => {
  const html = mdToHtml(['# 标题', '', '一段 **重点** 和 `code` 与 [链接](https://x.y/z?a=1&b=2)', '- 第一 <b>', '- 第二', '  续行', '1. 甲', '2. 乙', '', '```', 'a < b', '```', '---', '尾'].join('\n'));
  assert.match(html, /^<h1>标题<\/h1>/);
  assert.ok(html.includes('<b>重点</b>'));
  assert.ok(html.includes('<tt>code</tt>'));
  assert.ok(html.includes('<a href="https://x.y/z?a=1&amp;b=2">链接</a>'));
  assert.ok(html.includes('<ul>\n<li>第一 &lt;b&gt;</li>\n<li>第二<br>续行</li>\n</ul>'));
  assert.ok(html.includes('<ol>\n<li>甲</li>\n<li>乙</li>\n</ol>'));
  assert.ok(html.includes('<pre>a &lt; b</pre>'));
  assert.ok(html.includes('<hr>'));
  assert.ok(html.endsWith('<div>尾</div>'));
  assert.match(notesBody('OKR 日报 2026-09-03', '正文'), /^<h1>OKR 日报 2026-09-03<\/h1>\n<div>正文<\/div>$/);
});

test('plistXml: calendar interval, env, log paths; weekday only for weekly', () => {
  const daily = plistXml({ label: 'com.roacherm.okr.daily', program: ['/usr/local/bin/node', '/x/okr.js', 'job', 'run', 'daily'], hour: 11, minute: 0, env: { OKR_DIR: '/h/.okr', PATH: '/a:/b' }, log: '/h/.okr/logs/daily.log', workdir: '/h/.okr' });
  assert.ok(daily.includes('<string>com.roacherm.okr.daily</string>'));
  assert.ok(daily.includes('<key>Hour</key>\n\t\t<integer>11</integer>'));
  assert.ok(!daily.includes('Weekday'));
  assert.ok(daily.includes('<key>OKR_DIR</key>\n\t\t<string>/h/.okr</string>'));
  assert.ok(daily.includes('<key>StandardErrorPath</key>\n\t<string>/h/.okr/logs/daily.log</string>'));
  const weekly = plistXml({ label: 'w', program: ['n'], hour: 10, minute: 30, weekday: 1, env: {}, log: 'l', workdir: '/w' });
  assert.ok(weekly.includes('<key>Weekday</key>\n\t\t<integer>1</integer>'));
  assert.ok(weekly.includes('<key>Minute</key>\n\t\t<integer>30</integer>'));
  assert.ok(plistXml({ label: 'a&b', program: [], hour: 0, minute: 0, env: {}, log: '', workdir: '' }).includes('<string>a&amp;b</string>'));
});

test('parseTime / parseWeekday', () => {
  assert.deepEqual(parseTime('11:00'), { hour: 11, minute: 0 });
  assert.deepEqual(parseTime('9:05'), { hour: 9, minute: 5 });
  assert.equal(parseTime('25:00'), null);
  assert.equal(parseTime('11'), null);
  assert.equal(parseWeekday('mon'), 1);
  assert.equal(parseWeekday('Monday'), 1);
  assert.equal(parseWeekday('周一'), 1);
  assert.equal(parseWeekday('星期日'), 0);
  assert.equal(parseWeekday('7'), 0);
  assert.equal(parseWeekday('6'), 6);
  assert.equal(parseWeekday('x'), null);
});

test('agentCommand: claude / codex / other', () => {
  assert.deepEqual(agentCommand('/opt/homebrew/bin/claude'), { cmd: '/opt/homebrew/bin/claude', args: ['-p', '--output-format', 'text'] });
  assert.deepEqual(agentCommand('/x/codex', ['--model', 'm']), { cmd: '/x/codex', args: ['exec', '--skip-git-repo-check', '--model', 'm', '-'] });
  assert.deepEqual(agentCommand('/x/my-agent'), { cmd: '/x/my-agent', args: [] });
});

test('splitWeekly: pulls the trailing plan block out, leaves other code blocks alone', () => {
  const text = ['## 上周回顾', '```', 'kr1 ▓▓▓░░ 60%', '```', '## 本周提案', '- t1 因为到期', '```yaml', 'week: 2026-W37', 'new:', '  - {parent: kr1, name: 新任务}', 'plan: [t1, new:0]', 'drop: []', '```', ''].join('\n');
  const r = splitWeekly(text);
  assert.equal(r.plan, 'week: 2026-W37\nnew:\n  - {parent: kr1, name: 新任务}\nplan: [t1, new:0]\ndrop: []\n');
  assert.ok(r.markdown.includes('kr1 ▓▓▓░░ 60%'));
  assert.ok(!r.markdown.includes('week: 2026-W37'));
  assert.ok(r.markdown.endsWith('- t1 因为到期\n'));
  assert.deepEqual(splitWeekly('只有正文\n```yaml\nfoo: 1\n```'), { markdown: '只有正文\n```yaml\nfoo: 1\n```\n', plan: null });
  assert.equal(nextPlanFile('2026-W37', ['2026-W36.plan.yaml']), '2026-W37.plan.yaml');
  assert.equal(nextPlanFile('2026-W37', ['2026-W37.plan.yaml', '2026-W37.plan-2.yaml']), '2026-W37.plan-3.yaml');
});

test('prompts carry the data and the plan.yaml contract', () => {
  const d = dailyPrompt({ today: '2026-09-03', brief: { empty: false } });
  assert.ok(d.includes('"today": "2026-09-03"'));
  assert.ok(d.includes('昨日进度'));
  const w = weeklyPrompt({ thisWeek: { week: '2026-W37' }, review: {} });
  assert.ok(w.includes('week: 2026-W37'));
  assert.ok(w.includes('plan.yaml'));
});

test('normalizePlanWeek: forces week to the job label, keeps comments, leaves broken yaml alone', () => {
  assert.equal(normalizePlanWeek('week: 2026-W36\nplan: []\n', '2026-W36'), 'week: 2026-W36\nplan: []\n');
  assert.equal(normalizePlanWeek('# proposal\nweek: WEEK\nplan: []\n', '2026-W36'), '# proposal\nweek: 2026-W36\nplan: []\n');
  assert.equal(normalizePlanWeek('plan: []\n', '2026-W36'), 'week: 2026-W36\nplan: []\n');
  assert.equal(normalizePlanWeek('plan: [\n', '2026-W36'), 'plan: [\n');
});
