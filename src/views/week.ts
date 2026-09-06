import { AMBER, bold, color, dim, GRAY, GREEN, RED, rule, STAGE_SYM, truncate, width } from '../ansi.ts';
import type { TaskFacts, WeekView } from '../plan.ts';
import { velocity } from '../project.ts';
import type { Tree } from '../project.ts';
import type { NodeState } from '../types.ts';
import { flagTags } from './common.ts';
import { renderVelocity } from './velocity.ts';

export interface WeekOpts {
  width: number;
  selected?: number; // index into weekNodes()
  bare?: boolean;
  velocity?: boolean; // default true
}

/** Selectable order of the week page: planned by order, then carry-over. */
export function weekNodes(w: WeekView, t: Tree): NodeState[] {
  return [...w.planned, ...w.carryOver].map((f) => t.byId.get(f.id)).filter((s): s is NodeState => !!s);
}

/** One task, the same shape everywhere a task list is shown (week, candidates, apply). */
export function taskLine(f: TaskFacts, opts: { order?: boolean; selected?: boolean; width?: number } = {}): string {
  const st = STAGE_SYM[f.stage];
  const bits = [
    opts.order ? dim(f.order === null ? ' -' : String(f.order).padStart(2)) : '',
    color(st.c, st.sym),
    bold(f.id),
    f.name,
    f.priority ? dim(f.priority) : '',
    f.deadline ? (f.daysLeft !== null && f.daysLeft < 0 ? color(RED, `~${f.deadline}`) : dim(`~${f.deadline}`)) : '',
    flagTags(f.flags.filter((x) => x !== 'carry-over')),
    f.claimed ? dim(`@${f.claimed.by}`) : '',
  ].filter(Boolean);
  const line = (opts.selected ? color(GREEN, '▸') : ' ') + bits.join('  ');
  return opts.width ? truncate(line, opts.width) : line;
}

export function weekSummary(w: WeekView): string {
  const n = (st: string) => w.planned.filter((f) => f.stage === st).length;
  const parts = [`${w.planned.length} 计划`, n('done') ? color(GREEN, `${n('done')} 完成`) : '', n('doing') ? `${n('doing')} 进行中` : '', n('review') ? color(AMBER, `${n('review')} 待验收`) : '', n('blocked') ? color(RED, `${n('blocked')} 阻塞`) : '', w.carryOver.length ? color(AMBER, `${w.carryOver.length} 遗留`) : ''];
  return parts.filter(Boolean).join(dim(' · '));
}

/** The week page: plan in order, carry-over, pending proposals, throughput. */
export function renderWeek(w: WeekView, t: Tree, o: WeekOpts): { lines: string[]; selectedLine: number } {
  const W = o.width;
  const out: string[] = [];
  let selectedLine = -1;
  const prop = w.proposal === 'none' ? '' : `提案 ${w.proposal}${w.proposals.length > 1 ? ` (${w.proposals.length})` : ''}`;
  if (!o.bare) {
    const left = ` ${bold(w.current ? '本周' : w.week)}  ${dim(w.week)} ${dim(`${w.start.slice(5)} → ${w.end.slice(5)}`)}`;
    const right = `${weekSummary(w)}${prop ? '   ' + color(w.proposal === 'pending' ? AMBER : GRAY, prop) : ''} `;
    out.push(left + ' '.repeat(Math.max(1, W - width(left) - width(right))) + right);
    out.push(rule(W));
  } else {
    out.push(` ${dim(`${w.week}  ${w.start.slice(5)} → ${w.end.slice(5)}`)}   ${weekSummary(w)}${prop ? '   ' + color(w.proposal === 'pending' ? AMBER : GRAY, prop) : ''}`);
  }
  let i = 0;
  if (!w.planned.length) out.push(dim(`  这周还没排任务。okr candidates 看候选，提案写到 reports/${w.week}.plan.yaml 再 okr apply。`));
  for (const f of w.planned) {
    if (i === o.selected) selectedLine = out.length;
    out.push(taskLine(f, { order: true, selected: i === o.selected, width: W }));
    i++;
  }
  if (w.carryOver.length) {
    out.push(color(AMBER, ` 遗留 (${w.carryOver.length})`) + dim('  上周及更早排的，未完成；apply 时必须进 plan 或 drop'));
    for (const f of w.carryOver) {
      if (i === o.selected) selectedLine = out.length;
      out.push(taskLine(f, { selected: i === o.selected, width: W - 10 }) + dim(`  ${f.week}`));
      i++;
    }
  }
  if (w.proposal === 'pending') {
    out.push(color(AMBER, ' 待确认提案'));
    for (const p of w.proposals.filter((x) => x.status === 'pending')) out.push(truncate(`   ${p.file}  ${dim(`okr apply --from ${p.file} --confirmed  /  okr apply --dismiss`)}`, W));
  }
  if (o.velocity !== false) {
    out.push(rule(W));
    out.push(dim(' 吞吐  近 4 周'));
    out.push(...renderVelocity(velocity(t, 4), { width: W, bare: true }));
  }
  return { lines: out, selectedLine };
}
