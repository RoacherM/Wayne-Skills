import { color, dim, GRAY, GREEN, RED, STAGE_SYM, truncate } from '../ansi.ts';
import type { Tree } from '../project.ts';
import { STAGE_LABEL } from '../types.ts';
import type { NodeState } from '../types.ts';

export interface DepLink {
  node: NodeState | null; // null when the id points nowhere
  id: string;
  depth: number; // 1 = direct
  via: string | null; // the task that introduced an indirect dep
}

export interface DepChain {
  upstream: DepLink[]; // what this task waits on, direct first
  downstream: DepLink[]; // tasks waiting on this one
  blockedBy: string[]; // upstream ids not done (direct or indirect)
}

function settled(s: NodeState | null): boolean {
  return !!s && (s.stage === 'done' || s.effective === 'canceled');
}

/** Both directions of `deps`, transitively, cycle-safe. Answers "what is this task waiting on, and who waits on it". */
export function depChain(t: Tree, s: NodeState): DepChain {
  // direct deps first, then what they depend on, each indirect one keyed by the task that introduced it
  const upstream: DepLink[] = [];
  const seenUp = new Set<string>([s.node.id]);
  const walkUp = (x: NodeState, depth: number, via: string | null) => {
    const next: DepLink[] = [];
    for (const id of x.node.deps ?? []) {
      if (seenUp.has(id)) continue;
      seenUp.add(id);
      const link = { node: t.byId.get(id) ?? null, id, depth, via };
      upstream.push(link);
      next.push(link);
    }
    for (const l of next) if (l.node) walkUp(l.node, depth + 1, l.id);
  };
  walkUp(s, 1, null);

  const downstream: DepLink[] = [];
  const seenDown = new Set<string>([s.node.id]);
  const walkDown = (id: string, depth: number, via: string | null) => {
    for (const x of t.all) {
      if (!(x.node.deps ?? []).includes(id) || seenDown.has(x.node.id)) continue;
      seenDown.add(x.node.id);
      downstream.push({ node: x, id: x.node.id, depth, via });
      walkDown(x.node.id, depth + 1, x.node.id);
    }
  };
  walkDown(s.node.id, 1, null);

  const blockedBy = upstream.filter((l) => !settled(l.node)).map((l) => l.id);
  return { upstream, downstream, blockedBy };
}

function linkLine(l: DepLink, arrow: string, W: number): string {
  const indent = '  '.repeat(l.depth - 1);
  if (!l.node) return truncate(`   ${indent}${color(RED, arrow)} ${color(RED, l.id)} ${dim('不存在')}`, W);
  const st = STAGE_SYM[l.node.stage];
  const ok = settled(l.node);
  const via = l.via ? dim(`  经 ${l.via}`) : '';
  return truncate(`   ${indent}${color(ok ? GRAY : RED, arrow)} ${ok ? dim(l.id) : l.id} ${ok ? dim(l.node.node.name) : l.node.node.name}  ${color(st.c, `${st.sym} ${STAGE_LABEL[l.node.stage]}`)}${via}`, W);
}

/** Dependency chain block for a task: upstream above, the task itself, downstream below. */
export function renderDeps(t: Tree, s: NodeState, W: number): string[] {
  const c = depChain(t, s);
  if (!c.upstream.length && !c.downstream.length) return [];
  const out: string[] = [dim(' 依赖链')];
  for (const l of c.upstream) out.push(linkLine(l, '←', W));
  const st = STAGE_SYM[s.stage];
  out.push(`   ${color(GREEN, '▸')} ${s.node.id} ${s.node.name}  ${color(st.c, `${st.sym} ${STAGE_LABEL[s.stage]}`)}${c.blockedBy.length ? color(RED, `  等 ${c.blockedBy.join(' ')}`) : ''}`);
  for (const l of c.downstream) out.push(linkLine(l, '→', W));
  return out;
}
