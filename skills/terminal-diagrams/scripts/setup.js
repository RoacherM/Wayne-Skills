#!/usr/bin/env node
// setup — wire this skill into the agents on this machine. Idempotent; safe to rerun after an update.
//   node setup.js [--bin-dir ~/.local/bin] [--no-hooks] [--remove]
// 1. links <bin-dir>/mmd2txt -> scripts/mmd2txt.js, so the command also works in a plain shell
// 2. registers scripts/mmd-guard.js as a Stop hook in ~/.claude/settings.json and ~/.codex/hooks.json
//    (any older mmd-guard entry is replaced; other hooks are left alone)
// 3. prints the one-line rule to put in the global instruction file of each agent (CLAUDE.md / AGENTS.md)
import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const GUARD = join(HERE, 'mmd-guard.js');
const TOOL = join(HERE, 'mmd2txt.js');
const argv = process.argv.slice(2);
const remove = argv.includes('--remove');
const noHooks = argv.includes('--no-hooks');
const binDir = resolve((argv[argv.indexOf('--bin-dir') + 1] || '').replace(/^~/, homedir()) || join(homedir(), '.local', 'bin'));
const isGuard = (cmd) => /mmd-guard(\.js)?(\s|$)/.test(String(cmd || ''));

function link() {
  const dest = join(binDir, 'mmd2txt');
  mkdirSync(binDir, { recursive: true });
  if (existsSync(dest) || (() => { try { lstatSync(dest); return true; } catch { return false; } })()) rmSync(dest);
  if (remove) return console.log(`removed ${dest}`);
  symlinkSync(TOOL, dest);
  console.log(`linked  ${dest} -> ${TOOL}`);
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

link();
if (!noHooks) {
  hooks(join(homedir(), '.claude', 'settings.json'), '*', {});
  hooks(join(homedir(), '.codex', 'hooks.json'), '.*', { statusMessage: 'Checking reply for raw Mermaid...' });
}
if (!remove) {
  console.log(`
Add this line to each agent's global instruction file (~/.claude/CLAUDE.md, ~/.codex/AGENTS.md, ~/.config/opencode/AGENTS.md):

- Diagrams: the user reads in a terminal. Never send a \`\`\`mermaid fence. Use the terminal-diagrams skill: write the diagram to a scratch .mmd file, run \`mmd2txt FILE\` (or node <skill>/scripts/mmd2txt.js; exit 2 = too wide, split it), paste the output in a \`\`\`text fence. Unsupported kinds fall back to a text tree.

Hooks load on the next agent session (Codex asks once to trust the new hook).`);
}
