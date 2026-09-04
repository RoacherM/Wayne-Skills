import { dim, eventSym, pad, truncate } from '../ansi.ts';
import { dayOf, sortEvents } from '../dates.ts';
import type { Tree } from '../project.ts';
import type { Event, NodeState } from '../types.ts';
import { colorOf } from './common.ts';

export interface EventsOpts {
  width: number;
  events?: Event[]; // default: every event in the tree, plus node-less ones
  limit?: number;
}

/** Flat log across nodes, newest first. Answers "what happened lately". */
export function renderEvents(t: Tree, o: EventsOpts): string[] {
  const rows: { e: Event; s: NodeState | null }[] = [];
  const src = o.events ?? t.all.flatMap((s) => s.events);
  for (const e of src) rows.push({ e, s: e.node ? (t.byId.get(e.node) ?? null) : null });
  const ordered = sortEvents(rows.map((r) => ({ ts: r.e.ts, r }))).map((x) => x.r).reverse(); // newest first, same instant keeps reverse append order
  const shown = o.limit ? ordered.slice(0, o.limit) : ordered;

  const out: string[] = [];
  out.push(dim(` ${pad('日期', 12)}${pad('节点', 9)}${pad('类型', 11)}${pad('值', 6)}备注`));
  let lastMonth = '';
  for (const { e, s } of shown) {
    const m = e.ts.slice(0, 7);
    if (m !== lastMonth) {
      out.push(dim(` ${m.replace('-', ' · ')}`));
      lastMonth = m;
    }
    const c = s ? colorOf(t, s) : 245;
    const unit = s?.node.unit ?? '';
    const val = typeof e.value === 'number' ? pad(`${e.value}${unit === '%' ? '%' : ''}`, 5, 'right') : pad('', 5);
    const by = e.by ? dim(`@${e.by} `) : '';
    out.push(truncate(` ${dim(dayOf(e.ts))}  ${pad(e.node ?? dim('—'), 8)} ${eventSym(e.type, c)} ${pad(e.type, 9)}${val} ${by}${e.note}`, o.width));
  }
  if (!rows.length) out.push(dim('  还没有事件。'));
  return out;
}
