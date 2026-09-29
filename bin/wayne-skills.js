#!/usr/bin/env node
// Install global skills with the skills CLI (`npx skills`), linking them only for the agents on this machine.
//
// The CLI always writes the real copy to ~/.agents/skills/<name>. Codex, Pi and Grok read that directory
// themselves, so they need nothing more. Claude Code reads ~/.claude/skills (the CLI links it with -a claude-code);
// Antigravity reads ~/.gemini/config/skills, which the CLI does not know about, so we link it here.
//
// Never run `skills add` without -a or `skills update -g`: both install to every agent whose home directory
// exists and create that agent's skills directory, so each run leaves more stray directories in ~.
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Agents that need a link next to ~/.agents/skills. `home` decides whether the agent is installed. */
export const LINKED_AGENTS = [
  { id: 'claude-code', home: '.claude', skills: '.claude/skills', byCli: true },
  { id: 'antigravity', home: '.gemini/antigravity', skills: '.gemini/config/skills', byCli: false },
];

export const installedAgents = (home) => LINKED_AGENTS.filter((a) => existsSync(join(home, a.home)));

const lstat = (p) => {
  try {
    return lstatSync(p);
  } catch {
    return null;
  }
};

/** Link <agent skills>/<name> -> ~/.agents/skills/<name>. A real directory there belongs to the user and is left alone. */
export function linkSkill(home, agent, name) {
  const dir = join(home, agent.skills);
  const link = join(dir, name);
  const st = lstat(link);
  if (st && !st.isSymbolicLink()) return `${link} 是目录，没动`;
  if (st) rmSync(link);
  mkdirSync(dir, { recursive: true });
  symlinkSync(relative(dir, join(home, '.agents', 'skills', name)), link);
  return `${link} 已链接`;
}

export function unlinkSkill(home, agent, name) {
  const link = join(home, agent.skills, name);
  if (lstat(link)?.isSymbolicLink()) rmSync(link);
}

function skillsCli(args) {
  const r = spawnSync('npx', ['-y', '--no-audit', 'skills', ...args], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`npx skills ${args.join(' ')} 失败（退出码 ${r.status}）`);
}

export function add(home, source, names) {
  const agents = installedAgents(home);
  // codex is one of the CLI's agents that read ~/.agents/skills, so `-a codex` writes only the real copy and
  // keeps -a non-empty even on a machine without Claude Code.
  const agentArgs = ['codex', ...agents.filter((a) => a.byCli).map((a) => a.id)].flatMap((id) => ['-a', id]);
  skillsCli(['add', source, ...names.flatMap((n) => ['-s', n]), '-g', '-y', ...agentArgs]);
  for (const name of names) for (const a of agents.filter((x) => !x.byCli)) console.log(linkSkill(home, a, name));
}

/** The argument `skills add` needs to fetch this lock entry again. */
function sourceOf(entry) {
  if (entry.sourceType === 'github') return entry.source;
  if (entry.sourceType === 'well-known') return entry.sourceBaseUrl;
  return entry.sourceUrl;
}

export function update(home, only) {
  const lock = JSON.parse(readFileSync(join(home, '.agents', '.skill-lock.json'), 'utf8')).skills;
  const bySource = new Map();
  for (const [name, entry] of Object.entries(lock)) {
    if (only.length && !only.includes(name)) continue;
    const canonical = lstat(join(home, '.agents', 'skills', name));
    if (!canonical) {
      console.log(`跳过 ${name}：~/.agents/skills 里没有`);
      continue;
    }
    // A symlink here was put in place by another installer (ego-browser); `skills add` would replace it with a copy.
    if (canonical.isSymbolicLink()) {
      console.log(`跳过 ${name}：~/.agents/skills/${name} 是软链，由别的安装器管`);
      continue;
    }
    const src = sourceOf(entry);
    bySource.set(src, [...(bySource.get(src) ?? []), name]);
  }
  for (const [src, names] of bySource) add(home, src, names);
}

export function remove(home, names) {
  skillsCli(['remove', ...names.flatMap((n) => ['-s', n]), '-g', '-y']);
  for (const name of names) for (const a of LINKED_AGENTS.filter((x) => !x.byCli)) unlinkSkill(home, a, name);
}

const USAGE = `用法:
  wayne-skills add <source> -s <skill> [-s <skill>…]   装全局 skill，只给本机装了的 agent 建链接
  wayne-skills update [skill…]                         按 ~/.agents/.skill-lock.json 重装（代替 skills update -g）
  wayne-skills remove <skill…>                         卸载并删掉链接`;

function main(argv) {
  const home = homedir();
  const [cmd, ...rest] = argv;
  if (cmd === 'add') {
    const source = rest[0];
    const names = rest.flatMap((x, i) => (rest[i - 1] === '-s' || rest[i - 1] === '--skill' ? [x] : []));
    if (!source || source.startsWith('-') || !names.length) throw new Error(USAGE);
    if (names.includes('*')) throw new Error('要写出 skill 名，不支持 *（要按名字给 Antigravity 建链接）');
    add(home, source, names);
  } else if (cmd === 'update') update(home, rest);
  else if (cmd === 'remove' && rest.length) remove(home, rest);
  else throw new Error(USAGE);
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
