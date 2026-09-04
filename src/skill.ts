// Install the okr skill shipped with this package into the agents' skill directories.
// Layout mirrors `npx skills add … -g`: a real copy in ~/.agents/skills/okr (read by Codex, Copilot,
// OpenCode and friends) and a relative symlink ~/.claude/skills/okr -> ../../.agents/skills/okr for Claude Code.
import { cpSync, existsSync, lstatSync, mkdirSync, readlinkSync, rmSync, symlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SKILL_NAME = 'okr';
export const SKILL_SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'skills', SKILL_NAME);

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
