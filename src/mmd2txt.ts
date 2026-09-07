// mmd2txt — render Mermaid source as Unicode box art for a terminal, with grok-mermaid
// (a TypeScript port of the renderer in xAI's Grok Build; no browser). Bundled into
// skills/terminal-diagrams/scripts/mmd2txt.js by scripts/build.mjs.
//
//   mmd2txt [FILE.mmd] [--ansi] [--max-width N]      one diagram; stdin when FILE is omitted
//   mmd2txt --md [FILE.md] [--ansi] [--max-width N]  rewrite every ```mermaid fence in a Markdown file
//
// Exit 0 ok; 1 unsupported kind (source echoed in a box); 2 still wider than N after trying the
// perpendicular orientation (the caller should split the diagram or shorten labels).
import { readFileSync } from 'node:fs';
import { render, sourceBox, toAnsi } from 'grok-mermaid';

declare const __MMD2TXT_VERSION__: string;
const VERSION = typeof __MMD2TXT_VERSION__ === 'string' ? __MMD2TXT_VERSION__ : 'dev';

const HELP = `mmd2txt ${VERSION} - render a Mermaid diagram as Unicode box art for the terminal (engine: grok-mermaid)
usage: mmd2txt [FILE.mmd] [--ansi] [--max-width N]      one diagram; stdin when FILE is omitted
       mmd2txt --md [FILE.md] [--ansi] [--max-width N]  rewrite every \`\`\`mermaid fence in a Markdown file
kinds: flowchart/graph, sequence, state, class, er
exit:  0 ok | 1 unsupported kind (source echoed in a box) | 2 still wider than N (default 100) after trying the other direction`;

const DIR = /^(\s*(?:graph|flowchart)\s+)(TD|TB|LR|RL|BT)\b/m;

/** The same flowchart laid out the other way round (what oh-my-pi does when a diagram overflows). */
function flipped(src: string): string | null {
  const m = src.match(DIR);
  if (!m) return null;
  const to = { TD: 'LR', TB: 'LR', BT: 'LR', LR: 'TD', RL: 'TD' }[m[2] as 'TD' | 'TB' | 'BT' | 'LR' | 'RL'];
  return src.replace(DIR, `$1${to}`);
}

export interface Rendered {
  text: string;
  /** 0 ok, 1 unsupported, 2 too wide */
  code: 0 | 1 | 2;
  notes: string[];
}

export function renderOne(src: string, maxWidth: number, ansi = false): Rendered {
  const notes: string[] = [];
  let art = render(src);
  if (!art) {
    return { text: sourceBox(src, maxWidth).plain.join('\n'), code: 1, notes: ['unsupported diagram, source echoed'] };
  }
  if (art.width > maxWidth) {
    const other = flipped(src);
    const alt = other ? render(other) : null;
    if (alt && alt.width < art.width) {
      notes.push(`width ${art.width} > ${maxWidth}; re-laid out the other way (${alt.width})`);
      art = alt;
    }
  }
  for (const w of art.warnings) notes.push('dropped: ' + w);
  let code: 0 | 2 = 0;
  if (art.width > maxWidth) {
    code = 2;
    notes.push(`width ${art.width} > ${maxWidth}; split the diagram or shorten labels`);
  }
  return { text: (ansi ? toAnsi(art) : art.plain).join('\n'), code, notes };
}

const FENCE = /^```mermaid[^\n]*\n([\s\S]*?)^```[ \t]*$/gm;

/** Replace every ```mermaid fence in Markdown with a ```text fence holding the rendering. */
export function renderMarkdown(md: string, maxWidth: number, ansi = false): { text: string; code: 0 | 1 | 2; notes: string[] } {
  let code: 0 | 1 | 2 = 0;
  const notes: string[] = [];
  const text = md.replace(FENCE, (_, src: string) => {
    const r = renderOne(src, maxWidth, ansi);
    if (r.code > code) code = r.code;
    notes.push(...r.notes);
    return '```text\n' + r.text + '\n```';
  });
  return { text, code, notes };
}

function main(): number {
  const argv = process.argv.slice(2);
  if (argv.includes('-h') || argv.includes('--help')) {
    console.log(HELP);
    return 0;
  }
  if (argv.includes('--version')) {
    console.log(VERSION);
    return 0;
  }
  const flag = (n: string): string | null => {
    const i = argv.indexOf(n);
    if (i < 0) return null;
    const v = argv[i + 1] ?? null;
    argv.splice(i, 2);
    return v;
  };
  const has = (n: string): boolean => {
    const i = argv.indexOf(n);
    if (i < 0) return false;
    argv.splice(i, 1);
    return true;
  };
  const maxWidth = Number(flag('--max-width') ?? 100);
  const ansi = has('--ansi');
  const md = has('--md');
  const file = argv[0];
  const input = readFileSync(file ?? 0, 'utf8');
  const r = md ? renderMarkdown(input, maxWidth, ansi) : renderOne(input, maxWidth, ansi);
  for (const n of r.notes) console.error('mmd2txt: ' + n);
  process.stdout.write(md ? r.text : r.text + '\n');
  return r.code;
}

if (typeof __MMD2TXT_VERSION__ === 'string' || process.argv[1]?.endsWith('mmd2txt.ts')) {
  process.exitCode = main();
}
