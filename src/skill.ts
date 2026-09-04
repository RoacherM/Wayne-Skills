// Install the okr skill shipped with this package into the agents' skill directories.
// Layout mirrors `npx skills add … -g`: a real copy in ~/.agents/skills/okr (read by Codex, Copilot,
// OpenCode and friends) and a relative symlink ~/.claude/skills/okr -> ../../.agents/skills/okr for Claude Code.
// The CLI calls ensureSkill() on every run: a missing skill is installed, a copy we made (stamped) is
// refreshed when the packaged skill changes, anything else (dev symlink, hand-made dir) is left alone.
// A postinstall hook would be the obvious place, but npm 11 links a global git install to its temp
// clone whenever the package has install scripts, which breaks `npm install -g github:…`.
import { createHash } from 'node:crypto';
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SKILL_NAME = 'okr';
export const SKILL_SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'skills', SKILL_NAME);
/** Written into the copy we install; its absence means the directory is not ours to update. */
export const SKILL_STAMP = '.wayne-skills';

/** Content hash of a skill directory (stamp excluded), so ensureSkill can tell a stale copy from a current one. */
export function skillHash(dir: string): string {
  const files: string[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name !== SKILL_STAMP) files.push(full);
    }
  };
  walk(dir);
  const h = createHash('sha1');
  for (const f of files.sort()) h.update(relative(dir, f)).update('\0').update(readFileSync(f)).update('\0');
  return h.digest('hex');
}

export interface SkillPaths {
  agents: string;
  claude: string;
}

export function skillPaths(home = homedir()): SkillPaths {
  return { agents: join(home, '.agents', 'skills', SKILL_NAME), claude: join(home, '.claude', 'skills', SKILL_NAME) };
}

export interface SkillInstallResult {
  agents: { path: string; action: 'copied' | 'kept-symlink' };
  claude: { path: string; action: 'linked' | 'kept' | 'skipped-dir' };
}

const isSymlink = (p: string): boolean => {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
};

/**
 * Copy the skill into ~/.agents/skills and link it for Claude Code.
 * - An existing symlink in ~/.agents/skills (a dev checkout) is kept unless `force`.
 * - A real directory in ~/.claude/skills is never touched (the user put it there); a symlink is repointed.
 */
export function installSkill(opts: { home?: string; force?: boolean; src?: string } = {}): SkillInstallResult {
  const src = opts.src ?? SKILL_SRC;
  if (!existsSync(join(src, 'SKILL.md'))) throw new Error(`找不到 skill 源目录 ${src}`);
  const p = skillPaths(opts.home);

  let agentsAction: SkillInstallResult['agents']['action'] = 'copied';
  if (isSymlink(p.agents) && !opts.force) {
    agentsAction = 'kept-symlink';
  } else {
    mkdirSync(dirname(p.agents), { recursive: true });
    rmSync(p.agents, { recursive: true, force: true });
    cpSync(src, p.agents, { recursive: true });
    writeFileSync(join(p.agents, SKILL_STAMP), `${skillHash(src)}\n`);
  }

  const target = join('..', '..', '.agents', 'skills', SKILL_NAME);
  let claudeAction: SkillInstallResult['claude']['action'] = 'linked';
  if (isSymlink(p.claude)) {
    if (readlinkSync(p.claude) === target) claudeAction = 'kept';
    else {
      rmSync(p.claude);
      symlinkSync(target, p.claude);
    }
  } else if (existsSync(p.claude)) {
    claudeAction = 'skipped-dir';
  } else {
    mkdirSync(dirname(p.claude), { recursive: true });
    symlinkSync(target, p.claude);
  }
  return { agents: { path: p.agents, action: agentsAction }, claude: { path: p.claude, action: claudeAction } };
}

/** Remove what installSkill created. Real directories that are not ours (a dev symlink, a hand-made dir) are left alone. */
export function removeSkill(opts: { home?: string } = {}): { removed: string[]; kept: string[] } {
  const p = skillPaths(opts.home);
  const removed: string[] = [];
  const kept: string[] = [];
  if (isSymlink(p.claude)) {
    rmSync(p.claude);
    removed.push(p.claude);
  } else if (existsSync(p.claude)) kept.push(p.claude);
  if (isSymlink(p.agents)) kept.push(p.agents);
  else if (existsSync(p.agents)) {
    rmSync(p.agents, { recursive: true, force: true });
    removed.push(p.agents);
  }
  return { removed, kept };
}

export type EnsureAction = 'installed' | 'updated';

/**
 * Called on every CLI run. Installs the skill when ~/.agents/skills/okr is missing; refreshes it when it is a
 * copy we stamped and the packaged skill has changed. Returns null when nothing was done. Never throws.
 * OKR_SKIP_SKILL=1 turns it off.
 */
export function ensureSkill(opts: { home?: string; src?: string; env?: NodeJS.ProcessEnv } = {}): { action: EnsureAction; result: SkillInstallResult } | null {
  const env = opts.env ?? process.env;
  if (env.OKR_SKIP_SKILL === '1') return null;
  const src = opts.src ?? SKILL_SRC;
  const p = skillPaths(opts.home);
  try {
    if (!existsSync(join(src, 'SKILL.md'))) return null;
    if (isSymlink(p.agents)) return null;
    if (!existsSync(p.agents)) return { action: 'installed', result: installSkill({ home: opts.home, src }) };
    const stamp = join(p.agents, SKILL_STAMP);
    if (!existsSync(stamp)) return null;
    if (readFileSync(stamp, 'utf8').trim() === skillHash(src)) return null;
    return { action: 'updated', result: installSkill({ home: opts.home, src, force: true }) };
  } catch {
    return null;
  }
}
