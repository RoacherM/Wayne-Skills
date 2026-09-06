import { bold, color, dim, GRAY, GREEN, pad, rule, width } from '../ansi.ts';

export interface VelocityRow {
  week: string;
  start: string;
  done: number;
  hours: number | null;
  ids: string[];
}

export interface VelocityOpts {
  width: number;
  bare?: boolean;
}

/** Throughput: one bar per week, scaled to the best week. Answers "am I getting faster or slower". */
export function renderVelocity(v: readonly VelocityRow[], o: VelocityOpts): string[] {
  const out: string[] = [];
  if (!o.bare) {
    const left = ` ${bold('吞吐')}`;
    const right = `${dim('近')} ${v.length} ${dim('周')} `;
    out.push(left + ' '.repeat(Math.max(1, o.width - width(left) - width(right))) + right);
    out.push(rule(o.width));
  }
  const max = Math.max(1, ...v.map((r) => r.done));
  const barW = Math.max(6, Math.min(24, o.width - 40));
  for (const r of v) {
    const n = Math.round((r.done / max) * barW);
    const bar = color(r.done ? GREEN : GRAY, '█'.repeat(n)) + color(238, '░'.repeat(barW - n));
    const hours = r.hours === null ? dim('   —') : pad(`${r.hours}h`, 4, 'right');
    out.push(` ${r.week}  ${bar} ${pad(String(r.done), 3, 'right')}  ${hours}  ${dim(r.ids.join(' '))}`);
  }
  const total = v.reduce((a, r) => a + r.done, 0);
  const avg = v.length ? (total / v.length).toFixed(1) : '0';
  out.push(dim(` 合计 ${total} 个，平均每周 ${avg} 个`));
  return out;
}
