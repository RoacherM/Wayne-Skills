import { color, dim, goalColor, width } from '../ansi.ts';
import { addDays, dayOf, daysBetween, weekStart } from '../dates.ts';
import type { NodeState } from '../types.ts';

export interface HabitOpts {
  today: string;
  weeks: number;
  colorIdx: number;
}

/** Week-column heatmap, Monday to Sunday, newest week on the right. Answers "am I keeping it up". */
export function renderHabit(s: NodeState, o: HabitOpts): string[] {
  const c = goalColor(o.colorIdx);
  const days = s.habit?.days ?? new Set<string>();
  const start = s.node.start ?? (s.events.length ? dayOf(s.events[0].ts) : o.today);
  const thisWeek = weekStart(o.today);
  const firstWeek = weekStart(start);
  const nWeeks = Math.max(1, Math.min(o.weeks, Math.floor(daysBetween(firstWeek, thisWeek) / 7) + 1));
  const weeks: string[] = [];
  for (let i = nWeeks - 1; i >= 0; i--) weeks.push(addDays(thisWeek, -7 * i));

  const out: string[] = [];
  let header = '      ';
  let lastMonth = '';
  let skip = 0;
  for (const w of weeks) {
    const m = addDays(w, 6).slice(0, 7);
    if (skip > 0) { skip--; continue; }
    if (m !== lastMonth) {
      const t = `${+m.slice(5, 7)}月`;
      header += t;
      skip = Math.ceil(width(t) / 2) - 1;
      lastMonth = m;
    } else header += '  ';
  }
  out.push(dim(header));

  const dow = ['一', '二', '三', '四', '五', '六', '日'];
  for (let r = 0; r < 7; r++) {
    let line = ` ${dim(dow[r])}   `;
    for (const w of weeks) {
      const d = addDays(w, r);
      if (d > o.today || d < start) line += '  ';
      else line += (days.has(d) ? color(c, '■') : color(238, '·')) + ' ';
    }
    out.push(line);
  }

  const h = s.habit;
  if (h) {
    const unit = { day: '天', week: '周', month: '月' }[h.period];
    const last = s.daysSinceLast === null ? '还没开始' : s.daysSinceLast === 0 ? '今天做了' : `上次 ${s.daysSinceLast} 天前`;
    out.push('');
    out.push(` ${dim('总计')} ${h.total} 次${dim(`  ·  本${unit}`)} ${h.thisPeriod}/${h.times}${dim('  ·  连续达标')} ${h.streak} ${unit}${dim('  ·  ')}${last}`);
  }
  return out;
}
