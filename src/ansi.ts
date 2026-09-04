import type { EventType, Flag, Health, NodeKind, Stage } from './types.ts';

const E = '\x1b[';
export const reset = `${E}0m`;
export const fg = (n: number) => `${E}38;5;${n}m`;
export const bg = (n: number) => `${E}48;5;${n}m`;
export const bold = (s: string) => `${E}1m${s}${E}22m`;
export const dim = (s: string) => `${E}2m${s}${E}22m`;
export const color = (n: number, s: string) => `${fg(n)}${s}${E}39m`;
export const inverse = (s: string) => `${E}7m${s}${E}27m`;

export const GRAY = 245;
export const RED = 203;
export const GREEN = 41;
export const AMBER = 214;

/** One color per goal, cycling. Line colour belongs to the goal; event type is carried by shape. */
const PALETTE = [203, 75, 41, 214, 141, 44, 209, 111];
export const goalColor = (i: number) => PALETTE[i % PALETTE.length];

export const HEALTH: Record<Health, { sym: string; c: number; label: string }> = {
  'on-track': { sym: '●', c: GREEN, label: '正常' },
  'at-risk': { sym: '▲', c: AMBER, label: '有风险' },
  behind: { sym: '▼', c: RED, label: '落后' },
  done: { sym: '◆', c: GREEN, label: '完成' },
  blocked: { sym: '■', c: RED, label: '阻塞' },
  idle: { sym: '○', c: GRAY, label: '停滞' },
  frozen: { sym: '❄', c: GRAY, label: '冻结' },
  canceled: { sym: '×', c: GRAY, label: '取消' },
};

export const EVENT_SYM: Record<EventType, string> = {
  progress: '●',
  done: '◆',
  blocked: '■',
  claim: '▷',
  submit: '◇',
  reject: '↩',
  assess: '≈',
  change: '✎',
  plan: '☰',
  check: '✓',
  report: '¶',
};

export const STAGE_SYM: Record<Stage, { sym: string; c: number }> = {
  todo: { sym: '○', c: GRAY },
  doing: { sym: '◐', c: 75 },
  blocked: { sym: '■', c: RED },
  review: { sym: '◇', c: AMBER },
  done: { sym: '◆', c: GREEN },
};

export const KIND_ICON: Record<NodeKind, string> = { objective: '◎', metric: '▤', milestone: '⚑', task: '·', habit: '↻' };

export const FLAG_LABEL: Record<Flag, string> = {
  overdue: '已逾期',
  'due-soon': '将到期',
  blocked: '阻塞',
  stale: '停滞',
  'review-stale': '待验收超时',
  claimed: '已领取',
  'carry-over': '遗留',
};

/** Symbol for an event: red when it blocks, otherwise the node's colour. */
export function eventSym(type: EventType, c: number): string {
  return type === 'blocked' || type === 'reject' ? color(RED, EVENT_SYM[type]) : color(c, EVENT_SYM[type]);
}

export function healthTag(h: Health): string {
  const x = HEALTH[h];
  return color(x.c, `${x.sym} ${x.label}`);
}

export function strip(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

function isWide(cp: number): boolean {
  return (
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe4f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x1f300 && cp <= 0x1faff) ||
    (cp >= 0x20000 && cp <= 0x3fffd)
  );
}

/** Display width, counting CJK as two columns and ignoring ANSI codes. */
export function width(s: string): number {
  let w = 0;
  for (const ch of strip(s)) w += isWide(ch.codePointAt(0)!) ? 2 : 1;
  return w;
}

export function pad(s: string, n: number, align: 'left' | 'right' = 'left'): string {
  const w = width(s);
  if (w >= n) return s;
  const fill = ' '.repeat(n - w);
  return align === 'left' ? s + fill : fill + s;
}

/** Cut to n display columns, appending … when trimmed. Safe with ANSI codes. */
export function truncate(s: string, n: number): string {
  if (width(s) <= n) return s;
  let out = '';
  let w = 0;
  const re = /(\x1b\[[0-9;]*m)|([\s\S])/gu;
  for (const m of s.matchAll(re)) {
    if (m[1]) { out += m[1]; continue; }
    const cw = isWide(m[2].codePointAt(0)!) ? 2 : 1;
    if (w + cw > n - 1) break;
    out += m[2];
    w += cw;
  }
  return out + '…' + reset;
}

export function bar(pct: number, n: number, c: number): string {
  const filled = Math.round((Math.max(0, Math.min(100, pct)) / 100) * n);
  return color(c, '█'.repeat(filled)) + color(238, '░'.repeat(n - filled));
}

export function rule(n: number): string {
  return color(238, '─'.repeat(n));
}
