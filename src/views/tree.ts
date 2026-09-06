import { bar, bold, color, dim, healthTag, KIND_ICON, pad, rule, STAGE_SYM, truncate, width } from '../ansi.ts';
import type { Tree } from '../project.ts';
import type { NodeState } from '../types.ts';
import { STAGE_LABEL } from '../types.ts';
import { colorOf, flagTags, isInactive, pct, weekDeltaTag } from './common.ts';

export interface TreeOpts {
  width: number;
  selected?: number; // index into the flattened visible list
  bare?: boolean;
  showDone?: boolean;
}

/** Nodes in display order: file order, depth-first. Canceled hidden unless showDone. */
export function visibleNodes(t: Tree, showDone = false): NodeState[] {
  const out: NodeState[] = [];
  const walk = (s: NodeState) => {
    if (!showDone && (s.effective === 'canceled' || (s.node.kind === 'task' && s.stage === 'done' && !s.children.length))) return;
    out.push(s);
    for (const c of s.children) walk(c);
  };
  for (const r of t.roots) walk(r);
  return out;
}

export function renderTree(t: Tree, o: TreeOpts): { lines: string[]; selectedLine: number } {
  const W = o.width;
  const out: string[] = [];
  let selectedLine = -1;
  const list = visibleNodes(t, o.showDone);
  if (!o.bare) {
    const left = ` ${bold('OKR 树')}`;
    const right = `${t.all.length} 节点 · ${t.week}   ${dim('today')} ${t.today} `;
    out.push(left + ' '.repeat(Math.max(1, W - width(left) - width(right))) + right);
    out.push(rule(W));
  }
  list.forEach((s, i) => {
    if (i === o.selected) selectedLine = out.length;
    out.push(treeRow(t, s, i === o.selected, W));
  });
  if (!list.length) out.push(dim('  还没有节点。okr add 建一个。'));
  return { lines: out, selectedLine };
}

export function treeRow(t: Tree, s: NodeState, selected: boolean, W: number): string {
  const n = s.node;
  const c = colorOf(t, s);
  const inactive = isInactive(s);
  const cursor = selected ? color(c, '▸') : ' ';
  const indent = '  '.repeat(s.depth);
  const icon = inactive ? dim(KIND_ICON[n.kind]) : color(c, KIND_ICON[n.kind]);
  const id = inactive ? dim(n.id) : color(c, n.id);
  const name = inactive ? dim(n.name) : n.name;
  let tail: string;
  if (n.kind === 'task') {
    const st = STAGE_SYM[s.stage];
    const parts = [color(st.c, `${st.sym} ${STAGE_LABEL[s.stage]}`)];
    if (n.priority) parts.push(dim(n.priority));
    if (n.deadline && s.stage !== 'done') parts.push(dim(`⏱ ${n.deadline.slice(5)}`));
    if (s.planned) parts.push(dim('本周'));
    if (s.flags.length) parts.push(flagTags(s.flags.filter((f) => f !== 'blocked')));
    if (s.children.length) parts.push(dim(`子任务 ${pct(s.derived)}`));
    tail = parts.join('  ');
  } else if (n.kind === 'habit' && s.habit) {
    tail = `${dim('本周期')} ${s.habit.thisPeriod}/${s.habit.times}  ${healthTag(s.health)}`;
  } else {
    const parts = [bar((s.progress ?? 0) * 100, 12, inactive ? 238 : c), pad(pct(s.progress), 4, 'right')];
    const wd = weekDeltaTag(t, s);
    if (wd) parts.push(wd);
    if (s.assess?.stale) parts.push(dim(`评估 ${pct(s.assess.value)} 已过期`));
    else if (s.assess) parts.push(dim(`评估`));
    parts.push(healthTag(s.health));
    if (s.undecomposed) parts.push(dim(`${s.undecomposed} 个未拆解`));
    if (n.kind === 'metric') parts.push(dim(`${s.current ?? n.from ?? 0}${n.unit ?? ''} → ${n.to ?? ''}${n.unit ?? ''}`));
    tail = parts.join('  ');
  }
  return truncate(`${cursor}${indent}${icon} ${id} ${name}  ${tail}`, W);
}
