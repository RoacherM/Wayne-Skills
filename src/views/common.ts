import { color, dim, FLAG_LABEL, goalColor, GREEN, RED, AMBER, GRAY } from '../ansi.ts';
import { addDays, weekStart } from '../dates.ts';
import { progressAt } from '../project.ts';
import type { Tree } from '../project.ts';
import type { Flag, NodeState } from '../types.ts';

/** Colour follows the root node so a subtree keeps one line colour across views. */
export function rootIndex(t: Tree, s: NodeState): number {
  let r = s;
  while (r.parent) r = r.parent;
  return Math.max(0, t.roots.indexOf(r));
}

export function colorOf(t: Tree, s: NodeState): number {
  return goalColor(rootIndex(t, s));
}

export function pct(p: number | null): string {
  return p === null ? '—' : `${Math.round(p * 100)}%`;
}

const FLAG_COLOR: Partial<Record<Flag, number>> = { overdue: RED, blocked: RED, 'due-soon': AMBER, stale: GRAY, 'review-stale': AMBER };

export function flagTags(flags: Flag[]): string {
  return flags.map((f) => (FLAG_COLOR[f] ? color(FLAG_COLOR[f]!, FLAG_LABEL[f]) : dim(FLAG_LABEL[f]))).join(' ');
}

export function isInactive(s: NodeState): boolean {
  return s.effective !== 'active';
}

/** Progress change since Monday; null for tasks / habits or when there is nothing to compare. */
export function weekDelta(t: Tree, s: NodeState): number | null {
  if (s.node.kind === 'task' || s.node.kind === 'habit') return null;
  const before = progressAt(s, addDays(weekStart(t.today), -1));
  if (before === null || s.progress === null) return null;
  const d = s.progress - before;
  return Math.abs(d) < 0.005 ? null : d;
}

export function deltaText(d: number | null): string {
  return d === null ? '' : `${d > 0 ? '+' : ''}${Math.round(d * 100)}%`;
}

export function weekDeltaTag(t: Tree, s: NodeState): string {
  const d = weekDelta(t, s);
  return d === null ? '' : color(d > 0 ? GREEN : RED, `${d > 0 ? '▲' : '▼'}${deltaText(d)}`);
}
