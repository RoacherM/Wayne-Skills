// Markdown paint of the same derived data the ANSI views draw (DESIGN §7). Charts come through as fenced text blocks.
import { FLAG_LABEL, HEALTH, strip } from '../ansi.ts';
import { dayOf, daysBetween, sortEvents } from '../dates.ts';
import type { WeekView, TaskFacts } from '../plan.ts';
import { velocity } from '../project.ts';
import type { Tree } from '../project.ts';
import { KIND_LABEL, STAGE_LABEL } from '../types.ts';
import type { Event, NodeState } from '../types.ts';
import { deltaText, pct, weekDelta } from './common.ts';
import { depChain } from './deps.ts';
import { burnup } from './detail.ts';
import { renderHabit } from './habit.ts';
import type { ReportEntry } from './reports.ts';
import type { VelocityRow } from './velocity.ts';
import { boardNodes } from './status.ts';
import { visibleNodes } from './tree.ts';
import type { ReportStatus } from '../report.ts';

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const table = (head: string[], rows: string[][]): string[] => [
  `| ${head.join(' | ')} |`,
  `|${head.map(() => '---').join('|')}|`,
  ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`),
];
const fence = (lines: readonly string[]): string[] => ['```', ...lines.map((l) => strip(l).replace(/\s+$/, '')), '```'];
const health = (s: NodeState) => HEALTH[s.health].label;

export function mdStatus(t: Tree): string[] {
  const rows = boardNodes(t).map((s) => {
    const n = s.node;
    const kids = s.children.filter((c) => c.effective !== 'canceled');
    const done = kids.filter((c) => c.stage === 'done').length;
    const prog = n.kind === 'habit' && s.habit ? `${s.habit.thisPeriod}/${s.habit.times}` : pct(s.progress);
    const last = s.lastInTree ? `${dayOf(s.lastInTree.ts)} ${s.lastInTree.node && s.lastInTree.node !== n.id ? s.lastInTree.node + ': ' : ''}${s.lastInTree.note}` : '';
    return [n.id, n.name, n.area ?? '', prog, deltaText(weekDelta(t, s)), health(s), kids.length ? `${done}/${kids.length}` : '', last];
  });
  return [`# OKR 看板 ${t.today}`, '', ...table(['id', '目标', '领域', '进度', '本周', '健康', '子节点', '最近'], rows)];
}

function treeItem(t: Tree, s: NodeState): string {
  const n = s.node;
  const indent = '  '.repeat(s.depth);
  if (n.kind === 'task') {
    const bits = [`**${n.id}** ${n.name}`, STAGE_LABEL[s.stage], n.priority ?? '', n.deadline ? `~${n.deadline}` : '', s.planned ? '本周' : '', ...s.flags.filter((f) => f !== 'blocked').map((f) => FLAG_LABEL[f])];
    return `${indent}- [${s.stage === 'done' ? 'x' : ' '}] ${bits.filter(Boolean).join(' · ')}`;
  }
  if (n.kind === 'habit' && s.habit) return `${indent}- **${n.id}** ${n.name} · 本周期 ${s.habit.thisPeriod}/${s.habit.times} · ${health(s)}`;
  const bits = [`**${n.id}** ${n.name}`, KIND_LABEL[n.kind], pct(s.progress), deltaText(weekDelta(t, s)), health(s)];
  if (n.kind === 'metric') bits.push(`${s.current ?? n.from ?? 0}${n.unit ?? ''} → ${n.to ?? ''}${n.unit ?? ''}`);
  if (s.undecomposed) bits.push(`${s.undecomposed} 个未拆解`);
  return `${indent}- ${bits.filter(Boolean).join(' · ')}`;
}

export function mdTree(t: Tree, showDone = false): string[] {
  const list = visibleNodes(t, showDone);
  return [`# OKR 树 ${t.week}`, '', ...(list.length ? list.map((s) => treeItem(t, s)) : ['（还没有节点）'])];
}

function taskItem(f: TaskFacts, order = false): string {
  const bits = [`**${f.id}** ${f.name}`, STAGE_LABEL[f.stage], f.priority ?? '', f.deadline ? `~${f.deadline}` : '', ...f.flags.filter((x) => x !== 'carry-over' && x !== 'blocked').map((x) => FLAG_LABEL[x]), f.claimed ? `@${f.claimed.by}` : ''];
  return `${order ? `${f.order ?? '-'}. ` : '- '}${bits.filter(Boolean).join(' · ')}`;
}

export function mdVelocity(v: readonly VelocityRow[]): string[] {
  return table(['周', '完成', '用时', '任务'], v.map((r) => [r.week, String(r.done), r.hours === null ? '—' : `${r.hours}h`, r.ids.join(' ')]));
}

export function mdWeek(w: WeekView, t: Tree): string[] {
  const out = [`# ${w.week} ${w.current ? '本周' : ''} ${w.start} → ${w.end}`.replace(/\s+/g, ' '), ''];
  out.push('## 计划');
  out.push(...(w.planned.length ? w.planned.map((f) => taskItem(f, true)) : ['（还没排任务）']));
  if (w.carryOver.length) out.push('', '## 遗留', ...w.carryOver.map((f) => taskItem(f) + ` · ${f.week}`));
  if (w.proposal !== 'none') out.push('', '## 提案', ...w.proposals.map((p) => `- ${p.file} · ${p.status}`));
  out.push('', '## 吞吐', ...mdVelocity(velocity(t, 4)));
  return out;
}

export function mdEvents(t: Tree, events: readonly Event[]): string[] {
  const ordered = sortEvents(events).reverse();
  return table(
    ['日期', '节点', '类型', '值', '谁', '备注'],
    ordered.map((e) => [dayOf(e.ts), e.node ?? '', e.type, typeof e.value === 'number' ? `${e.value}${t.byId.get(e.node ?? '')?.node.unit === '%' ? '%' : ''}` : '', e.by ?? '', e.note]),
  );
}

export function mdDetail(s: NodeState, t: Tree, today: string, maxEvents = 12): string[] {
  const n = s.node;
  const path: string[] = [];
  let p = s.parent;
  while (p) {
    path.unshift(p.node.id);
    p = p.parent;
  }
  const out = [`# ${n.id} ${n.name}`, ''];
  const facts: string[] = [KIND_LABEL[n.kind]];
  if (path.length) facts.push(`所属 ${path.join(' › ')}`);
  if (n.area) facts.push(n.area);
  if (n.kind === 'metric') facts.push(`${n.unit ?? ''} ${n.from ?? 0} → ${n.to ?? '?'}`, `当前 ${s.current ?? n.from ?? 0}`, `进度 ${pct(s.derived)}`);
  else if (n.kind === 'task') {
    facts.push(STAGE_LABEL[s.stage]);
    if (n.priority) facts.push(n.priority);
    if (n.deadline) facts.push(`截止 ${n.deadline}`);
    if (n.week) facts.push(`计划 ${n.week}`);
    if (s.claimed) facts.push(`${s.claimed.by} 已领取`);
    facts.push(...s.flags.map((f) => FLAG_LABEL[f]));
  } else if (s.habit) facts.push(n.cadence ?? '1/week', `本周期 ${s.habit.thisPeriod}/${s.habit.times}`, `连续达标 ${s.habit.streak}`);
  else {
    facts.push(`推导 ${pct(s.derived)}`);
    if (s.assess) facts.push(`评估 ${pct(s.assess.value)}${s.assess.stale ? '（已过期）' : ''}`);
    const d = deltaText(weekDelta(t, s));
    if (d) facts.push(`本周 ${d}`);
  }
  if (n.kind !== 'task') facts.push(health(s));
  if (n.kind !== 'task' && n.kind !== 'habit') facts.push(`${n.start ?? '?'} → ${n.end ?? '不设截止'}`);
  out.push(facts.join(' · '));
  if (s.blocked) out.push('', `> 阻塞 ${daysBetween(s.blocked.since, today)} 天：${s.blocked.note}`);
  if (s.assess) out.push('', `> 评估理由：${s.assess.note}`);

  if (n.kind === 'task') {
    const sp = n.spec ?? {};
    out.push('', '## 规格', `- 目标：${sp.goal ?? '（缺）'}`);
    out.push(`- 验收：${sp.accept?.length ? '' : '（缺）'}`);
    (sp.accept ?? []).forEach((a, i) => out.push(`  ${i + 1}. ${a}`));
    out.push(`- 验证：${sp.verify ? '`' + sp.verify + '`' : '（缺）'}`);
    out.push(`- 链接：${sp.links?.length ? sp.links.join(' ') : '（缺）'}`);
    out.push(`- 派工：${s.dispatchable ? '可派工' : '不可派工'}`);
    const c = depChain(t, s);
    if (c.upstream.length || c.downstream.length) {
      out.push('', '## 依赖链');
      for (const l of c.upstream) out.push(`- ← ${l.id} ${l.node ? `${l.node.node.name} · ${STAGE_LABEL[l.node.stage]}` : '不存在'}${l.via ? ` · 经 ${l.via}` : ''}`);
      out.push(`- ▸ ${n.id} ${n.name}${c.blockedBy.length ? ` · 等 ${c.blockedBy.join(' ')}` : ''}`);
      for (const l of c.downstream) out.push(`- → ${l.id} ${l.node ? `${l.node.node.name} · ${STAGE_LABEL[l.node.stage]}` : ''}`);
    }
  } else if (n.kind === 'habit') {
    out.push('', '## 打卡', ...fence(renderHabit(s, { today, weeks: 26, colorIdx: 0 })));
  } else if (n.start) {
    out.push('', '## 燃起', ...fence(burnup(s, { width: 60, height: 8, today, c: 0 })));
  }

  if (s.children.length) {
    out.push('', '## 子节点');
    const walk = (x: NodeState) => {
      out.push(treeItem(t, x).replace(/^ {0,}/, (m) => ' '.repeat(Math.max(0, m.length - s.depth * 2 - 2))));
      for (const y of x.children) walk(y);
    };
    for (const ch of s.children) walk(ch);
  }
  const evs = [...s.events].reverse().slice(0, maxEvents);
  out.push('', '## 最近事件');
  out.push(...(evs.length ? mdEvents(t, evs) : ['（还没有记录）']));
  return out;
}

export function mdReportList(entries: readonly ReportEntry[], st: ReportStatus | null): string[] {
  const out = ['# 报告', ''];
  if (st) out.push(`日报 ${st.daily.today ? '今天已写' : st.daily.last ? `上次 ${dayOf(st.daily.last.ts)}` : '还没写过'} · 周报 ${st.weekly.thisWeek ? '本周已写' : st.weekly.last ? `上次 ${st.weekly.last.week ?? dayOf(st.weekly.last.ts)}` : '还没写过'}`, '');
  const KIND: Record<ReportEntry['kind'], string> = { weekly: '周报', daily: '日报', plan: '提案', other: '文件' };
  out.push(...table(['类型', '期间', '修改', '文件'], entries.map((e) => [KIND[e.kind], e.label, e.modified, e.file])));
  return out;
}
