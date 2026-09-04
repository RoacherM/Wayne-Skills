import { color, dim, FLAG_LABEL, goalColor, RED, AMBER, GRAY } from '../ansi.ts';
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
