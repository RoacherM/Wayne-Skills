#!/usr/bin/env node
// mmd-guard — Stop hook for Claude Code and Codex. If the reply that just finished still contains a
// ```mermaid fence, render each one with mmd2txt (github.com/RoacherM/mmd2txt, on PATH) and send the agent
// back (exit 2, reason on stderr) to resend the reply with ```text art. Reads the hook JSON on stdin;
// `stop_hook_active` true means this turn was already continued once, so exit 0 and let it stop (no loops).
// Never blocks on render errors, and does nothing when mmd2txt is not installed.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

let payload;
try {
  payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0);
}
if (payload.stop_hook_active) process.exit(0);
const msg = payload.last_assistant_message || '';
const fences = [...msg.matchAll(/^```mermaid[^\n]*\n([\s\S]*?)^```[ \t]*$/gm)].map((m) => m[1]);
if (fences.length === 0) process.exit(0);

const blocks = fences.map((src, i) => {
  const r = spawnSync('mmd2txt', ['--max-width', '100'], { input: src, encoding: 'utf8', timeout: 20000 });
  if (r.error?.code === 'ENOENT') {
    process.stderr.write('mmd-guard: mmd2txt is not on PATH (npm install -g github:RoacherM/mmd2txt); reply left as is\n');
    process.exit(0);
  }
  const art = (r.stdout || '').replace(/\n+$/, '');
  const note = (r.stderr || '').trim();
  if (r.status === 1 || !art) {
    return `diagram ${i + 1}: could not render (${note || r.error?.message || 'no output'}); redraw it as a text tree or pseudocode.`;
  }
  return `diagram ${i + 1}:\n\`\`\`text\n${art}\n\`\`\`` + (note ? `\n(${note})` : '');
});

process.stderr.write(
  `The reply you just sent contains ${fences.length} \`\`\`mermaid fence(s). The user reads in a terminal that cannot render ` +
    'Mermaid; they must never see raw Mermaid source. Resend the SAME reply now, with every ```mermaid fence replaced by ' +
    'the ```text rendering below (or the fallback it names). Change nothing else.\n\n' +
    blocks.join('\n\n') +
    '\n',
);
process.exit(2);
