import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { weekMonday } from '../dates.ts';
import { AMBER, bold, color, dim, GRAY, GREEN, pad, rule, truncate, width } from '../ansi.ts';
import type { ReportStatus } from '../report.ts';

export type ReportEntryKind = 'weekly' | 'daily' | 'plan' | 'other';

export interface ReportEntry {
  file: string;
  path: string;
  kind: ReportEntryKind;
  label: string; // week or day the file is about
  modified: string; // yyyy-mm-dd
  bytes: number;
}

const KIND_LABEL: Record<ReportEntryKind, string> = { weekly: '周报', daily: '日报', plan: '提案', other: '文件' };

function classify(file: string, dir: 'reports' | 'logs'): { kind: ReportEntryKind; label: string } | null {
  let m: RegExpMatchArray | null;
  if (dir === 'reports') {
    if ((m = file.match(/^(\d{4}-W\d{2})\.md$/))) return { kind: 'weekly', label: m[1] };
    if ((m = file.match(/^(\d{4}-W\d{2})\.plan(?:-\d+)?\.yaml$/))) return { kind: 'plan', label: m[1] };
    if (file.endsWith('.md')) return { kind: 'other', label: file.replace(/\.md$/, '') };
    return null;
  }
  if ((m = file.match(/^(\d{4}-\d{2}-\d{2})\.daily\.md$/))) return { kind: 'daily', label: m[1] };
  return null;
}

/** Everything under reports/ and the daily bodies under logs/, newest label first. */
export function listReports(reportsDir: string, logsDir: string): ReportEntry[] {
  const out: ReportEntry[] = [];
  const scan = (dir: string, which: 'reports' | 'logs') => {
    if (!existsSync(dir)) return;
    for (const file of readdirSync(dir)) {
      const c = classify(file, which);
      if (!c) continue;
      const path = join(dir, file);
      const st = statSync(path);
      out.push({ file, path, kind: c.kind, label: c.label, modified: st.mtime.toISOString().slice(0, 10), bytes: st.size });
    }
  };
  scan(reportsDir, 'reports');
  scan(logsDir, 'logs');
  // chronological across kinds: a week sorts by its Monday, a day by itself; same key → weekly, plan, daily
  const key = (e: ReportEntry) => (e.kind === 'daily' ? e.label : (weekMonday(e.label) ?? e.label));
  const rank: Record<ReportEntryKind, number> = { weekly: 0, plan: 1, daily: 2, other: 3 };
  return out.sort((a, b) => (key(b) < key(a) ? -1 : key(b) > key(a) ? 1 : rank[a.kind] - rank[b.kind] || (a.file < b.file ? -1 : 1)));
}

export interface ReportListOpts {
  width: number;
  selected?: number;
  bare?: boolean;
}

export function renderReportList(entries: readonly ReportEntry[], st: ReportStatus | null, o: ReportListOpts): { lines: string[]; selectedLine: number } {
  const W = o.width;
  const out: string[] = [];
  let selectedLine = -1;
  if (!o.bare) {
    const left = ` ${bold('报告')}`;
    const right = `${entries.length} ${dim('个文件')} `;
    out.push(left + ' '.repeat(Math.max(1, W - width(left) - width(right))) + right);
    out.push(rule(W));
  }
  if (st) {
    const d = st.daily.today ? color(GREEN, '今天已写') : st.daily.last ? dim(`上次 ${st.daily.last.ts.slice(0, 10)}`) : dim('还没写过');
    const w = st.weekly.thisWeek ? color(GREEN, '本周已写') : st.weekly.last ? dim(`上次 ${st.weekly.last.week ?? st.weekly.last.ts.slice(0, 10)}`) : dim('还没写过');
    out.push(` ${dim('日报')} ${d}   ${dim('周报')} ${w}`);
  }
  entries.forEach((e, i) => {
    if (i === o.selected) selectedLine = out.length;
    const cursor = i === o.selected ? color(GREEN, '▸') : ' ';
    const kc = e.kind === 'plan' ? AMBER : e.kind === 'other' ? GRAY : GREEN;
    out.push(truncate(`${cursor} ${color(kc, pad(KIND_LABEL[e.kind], 4))} ${pad(e.label, 11)} ${dim(pad(e.modified, 11))} ${dim(e.file)}`, W));
  });
  if (!entries.length) out.push(dim('  还没有报告。okr job install 装定时任务，或 okr report write 手动存。'));
  return { lines: out, selectedLine };
}

/** Wrap one line to `n` display columns, CJK-aware; never splits ANSI codes because doc text carries none. */
export function wrap(line: string, n: number): string[] {
  if (width(line) <= n) return [line];
  const out: string[] = [];
  let cur = '';
  let w = 0;
  for (const ch of line) {
    const cw = width(ch);
    if (w + cw > n) {
      out.push(cur);
      cur = '';
      w = 0;
    }
    cur += ch;
    w += cw;
  }
  if (cur) out.push(cur);
  return out;
}

/** Light markdown styling for reading a report inside the TUI. */
export function renderDoc(md: string, o: { width: number }): string[] {
  const W = Math.max(20, o.width - 2);
  const out: string[] = [];
  let code = false;
  for (const raw of md.replace(/\r/g, '').split('\n')) {
    if (raw.startsWith('```')) {
      code = !code;
      out.push(dim(' ' + raw));
      continue;
    }
    if (code) {
      for (const l of wrap(raw, W)) out.push(' ' + color(GRAY, l));
      continue;
    }
    let m: RegExpMatchArray | null;
    if ((m = raw.match(/^(#{1,3})\s+(.*)$/))) {
      if (out.length) out.push('');
      for (const l of wrap(m[2], W)) out.push(' ' + (m[1].length === 1 ? bold(l) : color(AMBER, bold(l))));
      continue;
    }
    if (raw.startsWith('>')) {
      for (const l of wrap(raw.replace(/^>\s?/, ''), W - 2)) out.push(' ' + dim('│ ' + l));
      continue;
    }
    if (raw.trim() === '---') {
      out.push(rule(W));
      continue;
    }
    const li = raw.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
    if (li) {
      const head = `${li[1]}${li[2] === '-' || li[2] === '*' ? '•' : li[2]} `;
      wrap(li[3], W - width(head)).forEach((l, i) => out.push(' ' + (i ? ' '.repeat(width(head)) : dim(head)) + inline(l)));
      continue;
    }
    for (const l of wrap(raw, W)) out.push(' ' + inline(l));
  }
  return out;
}

function inline(s: string): string {
  return s.replace(/\*\*([^*]+)\*\*/g, (_m, b) => bold(b)).replace(/`([^`]+)`/g, (_m, c) => color(75, c));
}
