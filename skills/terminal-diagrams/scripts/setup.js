#!/usr/bin/env node
// setup — wire this skill into the agents on this machine. Idempotent; safe to rerun after an update.
//   node setup.js [--remove]
// 1. checks that mmd2txt (github.com/RoacherM/mmd2txt) is on PATH; the skill and the hook both call it by name
// 2. registers scripts/mmd-guard.js as a Stop hook in ~/.claude/settings.json and ~/.codex/hooks.json
//    (any older mmd-guard entry is replaced; other hooks are left alone)
// 3. prints the one-line rule to put in the global instruction file of each agent (CLAUDE.md / AGENTS.md)
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const GUARD = join(HERE, 'mmd-guard.js');
const remove = process.argv.includes('--remove');
const isGuard = (cmd) => /mmd-guard(\.js)?(\s|$)/.test(String(cmd || ''));

function checkTool() {
  const r = spawnSync('mmd2txt', ['--version'], { encoding: 'utf8' });
  if (r.status === 0) return console.log(`mmd2txt ${r.stdout.trim()}`);
  console.log('mmd2txt is not on PATH; install it first:\n  npm install -g github:RoacherM/mmd2txt');
  process.exit(1);
}

function hooks(file, matcher, extra) {
  let doc = {};
  if (existsSync(file)) {
    try { doc = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { return console.log(`skipped ${file}: ${e.message}`); }
  } else if (remove) return;
  const h = (doc.hooks ??= {});
  const stop = (h.Stop ??= []);
  for (const group of stop) group.hooks = (group.hooks || []).filter((x) => !isGuard(x.command));
  h.Stop = stop.filter((g) => g.hooks.length > 0);
  if (!remove) h.Stop.push({ matcher, hooks: [{ type: 'command', command: GUARD.includes(' ') ? `"${GUARD}"` : GUARD, timeout: 30, ...extra }] });
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(doc, null, 2) + '\n');
  console.log(`${remove ? 'cleaned' : 'hooked '} ${file}`);
}

if (!remove) checkTool();
hooks(join(homedir(), '.claude', 'settings.json'), '*', {});
hooks(join(homedir(), '.codex', 'hooks.json'), '.*', { statusMessage: 'Checking reply for raw Mermaid...' });
if (!remove) {
  console.log(`
Add this line to each agent's global instruction file (~/.claude/CLAUDE.md, ~/.codex/AGENTS.md, ~/.config/opencode/AGENTS.md), or link global/AGENTS.md from the wayne-skills repo, which already has it:

- Diagrams: the user reads in a terminal. Never send a \`\`\`mermaid fence. Use the terminal-diagrams skill: write the diagram to a scratch .mmd file, run \`mmd2txt FILE\` (exit 2 = too wide, split it), paste the output in a \`\`\`text fence. Unsupported kinds fall back to a text tree.

Hooks load on the next agent session (Codex asks once to trust the new hook).`);
}
