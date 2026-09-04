import { bar, bold, color, dim, healthTag, pad, rule, truncate, width } from '../ansi.ts';
import { addDays } from '../dates.ts';
import type { Tree } from '../project.ts';
import type { NodeState } from '../types.ts';
import { colorOf, isInactive, pct } from './common.ts';

export interface StatusOpts {
  width: number;
  selected?: number;
  bare?: boolean;
}

/** Roots only, grouped by area in first-seen order. One line per root. */
export function boardNodes(t: Tree): NodeState[] {
  const roots = t.roots.filter((s) => s.effective !== 'canceled');
  const areas = [...new Set(roots.map((s) => s.node.area ?? ''))];
  return areas.flatMap((a) => roots.filter((s) => (s.node.area ?? '') === a));
}

export function renderStatus(t: Tree, o: StatusOpts): string[] {
  return renderStatusLines(t, o).lines;
}

export function renderStatusLines(t: Tree, o: StatusOpts): { lines: string[]; selectedLine: number } {
  const W = o.width;
  const ordered = boardNodes(t);
  const out: string[] = [];
  let selectedLine = -1;

  const tasks = t.all.filter((s) => s.node.kind === 'task' && s.effective !== 'canceled');
  const nBlocked = tasks.filter((s) => s.stage === 'blocked').length;
  const nReview = tasks.filter((s) => s.stage === 'review').length;
  const nPlanned = tasks.filter((s) => s.planned && s.stage !== 'done').length;
  const summary = [
    `${ordered.length} 目标`,
    nPlanned ? `本周 ${nPlanned} 任务` : '',
    nReview ? color(214, `${nReview} 待验收`) : '',
    nBlocked ? color(203, `${nBlocked} 阻塞`) : '',
  ]
    .filter(Boolean)
    .join(dim(' · '));
  if (!o.bare) {
    const left = ` ${bold('OKR 看板')}`;
    const right = `${summary}   ${dim('today')} ${t.today} `;
    out.push(left + ' '.repeat(Math.max(1, W - width(left) - width(right))) + right);
    out.push(rule(W));
  }

  let lastArea: string | null = null;
  ordered.forEach((s, idx) => {
    const area = s.node.area ?? '';
    if (area !== lastArea) {
      out.push(dim(` ${area || '未分类'}`));
      lastArea = area;
    }
    if (idx === o.selected) selectedLine = out.length;
    out.push(row(t, s, idx === o.selected, o));
  });
  if (!ordered.length) out.push(dim('  没有目标。'));
  return { lines: out, selectedLine };
}

function row(t: Tree, s: NodeState, selected: boolean, o: StatusOpts): string {
  const n = s.node;
  const c = colorOf(t, s);
  const cursor = selected ? color(c, ' ▸') : '  ';
  const id = pad(color(c, n.id), 6);
  const inactive = isInactive(s);
  const name = pad(inactive ? dim(n.name) : n.name, 16);

  let viz: string;
  let val: string;
  if (n.kind === 'habit' && s.habit) {
    const cells: string[] = [];
    for (let i = 15; i >= 0; i--) {
      const d = addDays(t.today, -i);
      cells.push(s.habit.days.has(d) ? color(c, '▪') : color(238, '·'));
    }
    viz = cells.join('');
    val = pad(`${s.habit.thisPeriod}/${s.habit.times}`, 5, 'right');
  } else {
    viz = bar((s.progress ?? 0) * 100, 16, inactive ? 238 : c);
    val = pad(pct(s.progress), 5, 'right');
  }

  const health = pad(healthTag(s.health), 9);
  const since = s.lastInTree ? Math.round((Date.parse(t.today) - Date.parse(s.lastInTree.ts.slice(0, 10))) / 86400000) : null;
  const age = since === null ? pad(dim('—'), 4, 'right') : pad(dim(`${since}d`), 4, 'right');
  const sub = n.kind === 'task' ? '' : childSummary(s);
  const note = s.lastInTree ? (s.lastInTree.node && s.lastInTree.node !== n.id ? dim(s.lastInTree.node + ': ') : '') + s.lastInTree.note : dim('还没有记录');

  const head = `${cursor} ${id} ${name} ${viz} ${val}  ${health} ${age}  ${sub}`;
  const room = o.width - width(head) - 1;
  return head + truncate(note, Math.max(4, room));
}

function childSummary(s: NodeState): string {
  const tasks = s.children.filter((c) => c.effective !== 'canceled');
  if (!tasks.length) return '';
  const done = tasks.filter((c) => c.stage === 'done').length;
  return dim(`${done}/${tasks.length} `) + (s.undecomposed ? dim(`未拆解 ${s.undecomposed} `) : '');
}
