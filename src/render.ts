import { strip } from './ansi.ts';

/** ANSI for a terminal, 80-column plain text for an agent pasting into a conversation, markdown for reports (DESIGN §7). */
export type Format = 'ansi' | 'plain' | 'md';

export function resolveFormat(o: { md?: boolean; plain?: boolean; ansi?: boolean; isTTY: boolean; noColor?: boolean }): Format {
  if (o.md) return 'md';
  if (o.ansi) return 'ansi';
  if (o.plain || !o.isTTY || o.noColor) return 'plain';
  return 'ansi';
}

export const PLAIN_WIDTH = 80;

export function paint(lines: readonly string[], fmt: Format): string {
  return fmt === 'ansi' ? lines.join('\n') : lines.map((l) => strip(l).replace(/\s+$/, '')).join('\n');
}
