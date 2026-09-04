import { bold, color, dim, EVENT_SYM, eventSym, GRAY, goalColor, healthTag, pad, RED, rule, STAGE_SYM, truncate, width } from '../ansi.ts';
import { addDays, dayOf, daysBetween, nextMonth } from '../dates.ts';
import { clamp, progressAt } from '../project.ts';
import type { Tree } from '../project.ts';
import { KIND_LABEL, STAGE_EVENTS, STAGE_LABEL } from '../types.ts';
import type { NodeState } from '../types.ts';
import { flagTags, pct } from './common.ts';
import { renderHabit } from './habit.ts';
import { treeRow } from './tree.ts';

export interface DetailOpts {
  width: number;
  today: string;
  colorIdx: number;
  maxEvents?: number;
  tree?: Tree; // for the children block
}

export function renderDetail(s: NodeState, o: DetailOpts): string[] {
  const n = s.node;
  const c = goalColor(o.colorIdx);
  const out: string[] = [];

  const meta = [n.area, KIND_LABEL[n.kind], n.weight && n.weight !== 1 ? `权重 ${n.weight}` : '', n.status && n.status !== 'active' ? n.status : '']
    .filter(Boolean)
    .join(' · ');
  const crumbs = s.parent ? dim(pathOf(s) + ' › ') : '';
  const title = ` ${crumbs}${color(c, bold(n.id))}  ${bold(n.name)}`;
  out.push(title + ' '.repeat(Math.max(1, o.width - width(title) - width(meta) - 1)) + dim(meta));

  const facts: string[] = [];
  if (n.kind === 'metric') {
    facts.push(`${n.unit ?? ''} ${n.from ?? 0} → ${n.to ?? '?'}`);
    facts.push(`当前 ${bold(String(s.current ?? n.from ?? 0))}`);
    facts.push(`进度 ${bold(pct(s.derived))}`);
  } else if (n.kind === 'task') {
    const st = STAGE_SYM[s.stage];
    facts.push(color(st.c, `${st.sym} ${STAGE_LABEL[s.stage]}`));
    if (n.priority) facts.push(n.priority);
    if (n.deadline) facts.push(`截止 ${n.deadline}`);
    if (n.week) facts.push(`计划 ${n.week}`);
    if (s.claimed) facts.push(`${s.claimed.by} 已领取${s.claimed.session ? dim(` (${s.claimed.session})`) : ''}`);
    if (s.flags.length) facts.push(flagTags(s.flags));
  } else if (s.habit) {
    facts.push(`${n.cadence ?? '1/week'}`);
    facts.push(`本周期 ${bold(`${s.habit.thisPeriod}/${s.habit.times}`)}`);
    facts.push(`连续达标 ${bold(String(s.habit.streak))}`);
  } else {
    facts.push(`推导 ${bold(pct(s.derived))}`);
    if (s.assess) facts.push(`评估 ${bold(pct(s.assess.value))}${s.assess.stale ? color(RED, ` 已过期 (${daysBetween(s.assess.ts, o.today)} 天前)`) : dim(` (${daysBetween(s.assess.ts, o.today)} 天前)`)}`);
    if (s.undecomposed) facts.push(`${s.undecomposed} 个未拆解`);
  }
  if (n.kind !== 'task') facts.push(healthTag(s.health));
  if (n.kind !== 'task' && n.kind !== 'habit') {
    const period = n.end
      ? `${n.start ?? '?'} → ${n.end}${s.elapsed !== null ? dim(`  已过 ${Math.round(s.elapsed * 100)}%`) : ''}`
      : `${n.start ?? '?'} → ${dim('不设截止')}`;
    facts.push(period);
  }
  out.push(' ' + facts.join(dim('   ')));

  if (s.blocked) out.push(' ' + color(RED, `■ 阻塞 ${daysBetween(s.blocked.since, o.today)} 天`) + dim('  ') + s.blocked.note);
  if (s.assess) out.push(' ' + dim('评估理由 ') + s.assess.note);
  out.push(rule(o.width));

  if (n.kind === 'habit') {
    out.push(...renderHabit(s, { today: o.today, weeks: Math.min(26, Math.floor((o.width - 8) / 2)), colorIdx: o.colorIdx }));
    out.push(rule(o.width));
  } else if (n.kind === 'task') {
    out.push(...specBlock(s, o.tree));
  } else if (n.start) {
    out.push(...burnup(s, { width: Math.min(o.width - 9, 72), height: 8, today: o.today, c }));
    out.push(rule(o.width));
  }

  if (s.children.length && o.tree) {
    out.push(dim(' 子节点'));
    const walk = (x: NodeState) => {
      out.push(treeRow(o.tree!, x, false, o.width));
      for (const y of x.children) walk(y);
    };
    for (const ch of s.children) walk(ch);
    out.push(rule(o.width));
  }

  out.push(dim(' 最近事件'));
  const evs = [...s.events].reverse().slice(0, o.maxEvents ?? 8);
  for (const e of evs) {
    const val = typeof e.value === 'number' ? pad(`${e.value}${n.unit === '%' ? '%' : ''}`, 5, 'right') : pad('', 5);
    const by = e.by ? dim(`@${e.by} `) : '';
    out.push(truncate(` ${dim(dayOf(e.ts))}  ${eventSym(e.type, c)} ${pad(e.type, 8)} ${val}  ${by}${e.note}`, o.width));
  }
  if (!evs.length) out.push(dim('  还没有记录'));
  return out;
}

function pathOf(s: NodeState): string {
  const ids: string[] = [];
  let p = s.parent;
  while (p) {
    ids.unshift(p.node.id);
    p = p.parent;
  }
  return ids.join(' › ');
}

function specBlock(s: NodeState, t?: Tree): string[] {
  const n = s.node;
  const out: string[] = [];
  const sp = n.spec ?? {};
  const line = (k: string, v: string | undefined) => out.push(` ${dim(pad(k, 6))} ${v ? v : color(RED, '（缺）')}`);
  line('目标', sp.goal);
  if (sp.accept?.length) sp.accept.forEach((a, i) => out.push(` ${dim(pad(i ? '' : '验收', 6))} ${i + 1}. ${a}`));
  else line('验收', undefined);
  line('验证', sp.verify);
  if (sp.links?.length) sp.links.forEach((l, i) => out.push(` ${dim(pad(i ? '' : '链接', 6))} ${l}`));
  else line('链接', undefined);
  if (n.deps?.length) {
    const deps = n.deps.map((d) => {
      const dep = t?.byId.get(d);
      return dep ? (dep.stage === 'done' || dep.effective === 'canceled' ? dim(d) : color(RED, d)) : color(RED, `${d}?`);
    });
    out.push(` ${dim(pad('依赖', 6))} ${deps.join(' ')}`);
  }
  out.push(` ${dim(pad('派工', 6))} ${s.dispatchable ? color(41, '可派工') : dim('不可派工')}`);
  out.push(rule(40));
  return out;
}

interface BurnOpts {
  width: number;
  height: number;
  today: string;
  c: number;
}

/** Burn-up: rows are % complete, columns are days. Dots are pace against the deadline, solid is what happened. */
function burnup(s: NodeState, o: BurnOpts): string[] {
  const n = s.node;
  const start = n.start!;
  const end = n.end ?? addDays(o.today, 14);
  const total = Math.max(1, daysBetween(start, end));
  const W = Math.max(20, o.width);
  const H = o.height;
  const dayAt = (col: number) => addDays(start, Math.round((col / (W - 1)) * total));
  const colOf = (d: string) => Math.max(0, Math.min(W - 1, Math.round((daysBetween(start, d) / total) * (W - 1))));
  const rowOf = (p: number | null) => H - 1 - Math.round(clamp(p ?? 0) * (H - 1));

  type Cell = { ch: string; col: number };
  const grid: Cell[][] = Array.from({ length: H }, () => Array.from({ length: W }, () => ({ ch: ' ', col: 0 })));
  const put = (r: number, c: number, ch: string, col: number) => {
    if (r >= 0 && r < H && c >= 0 && c < W) grid[r][c] = { ch, col };
  };

  if (n.end) for (let c = 0; c < W; c++) put(rowOf(c / (W - 1)), c, '·', GRAY);

  const todayCol = o.today < start ? -1 : colOf(o.today > end ? end : o.today);
  let prev = rowOf(progressAt(s, dayAt(0)));
  for (let c = 0; c <= todayCol; c++) {
    const r = rowOf(progressAt(s, dayAt(c)));
    if (r === prev) put(r, c, '━', o.c);
    else {
      const up = r < prev;
      put(prev, c, up ? '┛' : '┓', o.c);
      for (let rr = Math.min(r, prev) + 1; rr < Math.max(r, prev); rr++) put(rr, c, '┃', o.c);
      put(r, c, up ? '┏' : '┗', o.c);
      prev = r;
    }
  }

  const stageEv = s.events.filter((e) => STAGE_EVENTS.has(e.type));
  for (const e of stageEv) {
    const d = dayOf(e.ts);
    if (d > o.today || d > end) continue;
    if (e.type === 'progress' && typeof e.value !== 'number') continue;
    put(rowOf(progressAt(s, d)), colOf(d), EVENT_SYM[e.type], e.type === 'blocked' ? RED : o.c);
  }

  const axis: string[] = Array.from({ length: W }, () => color(238, '─'));
  stageEv.forEach((e, i) => {
    if (e.type !== 'blocked') return;
    const next = stageEv[i + 1];
    const to = next ? dayOf(next.ts) : o.today;
    for (let c = colOf(dayOf(e.ts)); c <= colOf(to > end ? end : to); c++) axis[c] = color(RED, '▒');
  });

  const lines: string[] = [];
  const label = (r: number) => (r === 0 ? '100%' : r === H - 1 ? '  0%' : r === rowOf(0.5) ? ' 50%' : '');
  for (let r = 0; r < H; r++) {
    const cells = grid[r].map((x) => (x.col ? color(x.col, x.ch) : x.ch)).join('');
    lines.push(` ${dim(pad(label(r), 4, 'right'))} ${color(238, '│')}${cells}`);
  }
  lines.push(`      ${color(238, '└')}${axis.join('')}`);

  const ticks = Array.from({ length: W }, () => ' ');
  let d = start.slice(0, 7) + '-01';
  if (d < start) d = nextMonth(d);
  for (; d <= end; d = nextMonth(d)) {
    const c = colOf(d);
    const t = `${+d.slice(5, 7)}月`;
    if (c + t.length + 1 < W) for (let i = 0; i < t.length; i++) ticks[c + i] = t[i];
  }
  let tickLine = ticks.join('');
  if (todayCol >= 0 && todayCol < W - 6) tickLine = tickLine.slice(0, todayCol) + 'today' + tickLine.slice(todayCol + 5);
  lines.push(`       ${dim(tickLine)}`);
  return lines;
}
