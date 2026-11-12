#!/usr/bin/env node
// Keep this machine's global skills equal to global/skills.json.
//
// Every skill lives at ~/.agents/skills/<name>. Codex, Pi, Epi and Factory Droid read that directory themselves.
// Claude Code reads ~/.claude/skills, Grok reads ~/.grok/skills, and Antigravity reads ~/.gemini/config/skills,
// so each installed agent gets a link per skill.
//
// The manifest has three kinds of entry:
//   links    ~/.agents/skills/<name> is a symlink to a local checkout (this repo, or another repo). Edits are live.
//   remote   installed as a copy by the skills CLI (`npx skills add <source> -s <name>`); `update` refreshes it.
//   external installed and refreshed by another tool (the value says which command); we only check it is there.
//   files    a folder copied from GitHub ("owner/repo/path") to a local path, for files that skills reference
//            outside their own folder (pstack skills read ../../docs, so ~/.agents/docs). `update` refreshes it.
//
// Never run `skills add` without -a or `skills update -g`: both install to every agent whose home directory
// exists and create that agent's skills directory, so each run leaves more stray directories in ~.
import { spawnSync } from 'node:child_process';
import {
  cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, symlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = fileURLToPath(new URL('..', import.meta.url));
export const MANIFEST = join(REPO, 'global', 'skills.json');

/** Agents that need a link next to ~/.agents/skills. `home` decides whether the agent is installed. */
export const LINKED_AGENTS = [
  { id: 'claude-code', home: '.claude', skills: '.claude/skills' },
  { id: 'grok', home: '.grok', skills: '.grok/skills' },
  { id: 'antigravity', home: '.gemini/antigravity', skills: '.gemini/config/skills' },
];

export const installedAgents = (home) => LINKED_AGENTS.filter((a) => existsSync(join(home, a.home)));

const lstat = (p) => {
  try {
    return lstatSync(p);
  } catch {
    return null;
  }
};
const real = (p) => {
  try {
    return realpathSync(p);
  } catch {
    return null;
  }
};

/**
 * Link <agent skills>/<name> -> ~/.agents/skills/<name>. Returns a message when something changed or was refused,
 * null when the link was already right. A real directory there belongs to the user and is left alone.
 */
export function linkSkill(home, agent, name) {
  const dir = join(home, agent.skills);
  const link = join(dir, name);
  const target = relative(dir, join(home, '.agents', 'skills', name));
  const st = lstat(link);
  if (st && !st.isSymbolicLink()) return `${link} 是目录，没动`;
  if (st && real(link) === real(join(dir, target))) return null;
  if (st) rmSync(link);
  mkdirSync(dir, { recursive: true });
  symlinkSync(target, link);
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

/** Copy skills from a remote source into ~/.agents/skills. `-a codex` writes only that copy; we link agents ourselves. */
const install = (source, names) => skillsCli(['add', source, ...names.flatMap((n) => ['-s', n]), '-g', '-y', '-a', 'codex']);

/** Replace `dest` with the folder `owner/repo/path` from the repo's default branch (sparse, shallow clone). */
export function fetchDir(spec, dest) {
  const [owner, repo, ...rest] = spec.split('/');
  const sub = rest.join('/');
  const tmp = mkdtempSync(join(tmpdir(), 'wayne-skills-'));
  const git = (...args) => {
    const r = spawnSync('git', args, { stdio: ['ignore', 'ignore', 'inherit'] });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')} 失败（退出码 ${r.status}）`);
  };
  try {
    git('clone', '-q', '--depth', '1', '--filter=blob:none', '--sparse', `https://github.com/${owner}/${repo}.git`, tmp);
    git('-C', tmp, 'sparse-checkout', 'set', sub);
    if (!existsSync(join(tmp, sub))) throw new Error(`${spec} 不存在`);
    rmSync(dest, { recursive: true, force: true });
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(join(tmp, sub), dest, { recursive: true });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

export const readManifest = (path = MANIFEST) => JSON.parse(readFileSync(path, 'utf8'));

const lockPath = (home) => join(home, '.agents', '.skill-lock.json');
const readLock = (home) => (existsSync(lockPath(home)) ? JSON.parse(readFileSync(lockPath(home), 'utf8')) : null);

/** `~/x` is under home, a relative path is under the repo. */
const resolvePath = (home, repo, p) => (p.startsWith('~/') ? join(home, p.slice(2)) : isAbsolute(p) ? p : join(repo, p));

const wantedNames = (manifest) =>
  new Set([...Object.keys(manifest.links ?? {}), ...Object.values(manifest.remote ?? {}).flat(), ...Object.keys(manifest.external ?? {})]);

/** Skills in ~/.agents/skills that the manifest does not list: what `--prune` would remove. */
export function strays(home, manifest) {
  const root = join(home, '.agents', 'skills');
  if (!existsSync(root)) return [];
  const wanted = wantedNames(manifest);
  return readdirSync(root).filter((name) => !name.startsWith('.') && !wanted.has(name));
}

const stampOf = (d) => d.toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-');

/**
 * Make ~/.agents/skills match the manifest. Real directories that must go are moved to ~/.agents/backup/sync-<time>,
 * never deleted. With `prune`, skills not in the manifest are removed too. Returns what it did, one line each.
 */
export function sync(home, manifest, { repo = REPO, prune = false, now = new Date(), installRemote = install, fetchFiles = fetchDir } = {}) {
  const root = join(home, '.agents', 'skills');
  const backup = join(home, '.agents', 'backup', `sync-${stampOf(now)}`);
  const log = [];
  const stash = (name) => {
    mkdirSync(backup, { recursive: true });
    renameSync(join(root, name), join(backup, name));
    log.push(`${name}：原目录移到 ${backup}`);
  };
  mkdirSync(root, { recursive: true });

  const links = manifest.links ?? {};
  const remote = manifest.remote ?? {};
  const external = manifest.external ?? {};
  const remoteNames = Object.values(remote).flat();
  const wanted = wantedNames(manifest);

  for (const [name, p] of Object.entries(links)) {
    const target = resolvePath(home, repo, p);
    if (!existsSync(join(target, 'SKILL.md'))) {
      log.push(`跳过 ${name}：${target} 里没有 SKILL.md`);
      continue;
    }
    const dst = join(root, name);
    const st = lstat(dst);
    if (st?.isSymbolicLink() && real(dst) === real(target)) continue;
    if (st?.isSymbolicLink()) rmSync(dst);
    else if (st) stash(name);
    symlinkSync(target, dst);
    log.push(`${name} -> ${target}`);
  }

  for (const [source, names] of Object.entries(remote)) {
    const missing = names.filter((n) => !lstat(join(root, n)));
    if (!missing.length) continue;
    installRemote(source, missing);
    log.push(`装好 ${missing.join(', ')}（${source}）`);
  }

  for (const [name, how] of Object.entries(external)) if (!lstat(join(root, name))) log.push(`缺 ${name}：跑 ${how}`);

  for (const [dest, spec] of Object.entries(manifest.files ?? {})) {
    const path = resolvePath(home, repo, dest);
    if (existsSync(path)) continue;
    fetchFiles(spec, path);
    log.push(`${path} <- ${spec}`);
  }

  if (prune) {
    for (const name of strays(home, manifest)) {
      for (const a of LINKED_AGENTS) unlinkSkill(home, a, name);
      if (lstat(join(root, name)).isSymbolicLink()) {
        rmSync(join(root, name));
        log.push(`删掉软链 ${name}`);
      } else stash(name);
    }
  }

  for (const name of wanted) {
    if (!lstat(join(root, name))) continue;
    for (const a of installedAgents(home)) {
      const msg = linkSkill(home, a, name);
      if (msg) log.push(msg);
    }
  }

  // The lock only tracks remote copies: `update` reads it, and a linked or external skill must not be re-copied.
  const lock = readLock(home);
  if (lock) {
    const keep = (name) => (prune ? remoteNames.includes(name) : !(name in links) && !(name in external));
    const before = Object.keys(lock.skills).length;
    lock.skills = Object.fromEntries(Object.entries(lock.skills).filter(([name]) => keep(name)));
    const dropped = before - Object.keys(lock.skills).length;
    if (dropped) {
      writeFileSync(lockPath(home), `${JSON.stringify(lock, null, 2)}\n`);
      log.push(`lock 去掉 ${dropped} 条`);
    }
  }
  return log;
}

/** The argument `skills add` needs to fetch this lock entry again. */
function sourceOf(entry) {
  if (entry.sourceType === 'github') return entry.source;
  if (entry.sourceType === 'well-known') return entry.sourceBaseUrl;
  return entry.sourceUrl;
}

/** Re-copy remote skills from the sources in the lock (all, or only the names given), then the manifest's files. */
export function update(home, only, manifest = readManifest()) {
  const lock = readLock(home)?.skills ?? {};
  const bySource = new Map();
  for (const [name, entry] of Object.entries(lock)) {
    if (only.length && !only.includes(name)) continue;
    const st = lstat(join(home, '.agents', 'skills', name));
    if (!st || st.isSymbolicLink()) continue;
    const src = sourceOf(entry);
    bySource.set(src, [...(bySource.get(src) ?? []), name]);
  }
  for (const [src, names] of bySource) install(src, names);
  if (only.length) return;
  for (const [dest, spec] of Object.entries(manifest.files ?? {})) fetchDir(spec, resolvePath(home, REPO, dest));
}

const USAGE = `用法:
  wayne-skills sync                 按 global/skills.json 装齐全局 skill，并给本机的 agent 建链接
  wayne-skills sync --prune         同上，再列出清单外的 skill（只列，不动）
  wayne-skills sync --prune --yes   同上，并把清单外的 skill 移到 ~/.agents/backup/sync-<时间>/
  wayne-skills update [skill…]      重新拉 remote 类 skill 和 files（代替 skills update -g）

增删 skill：改 global/skills.json，跑 sync --prune 看清单外有什么，确认后加 --yes。
别的工具装的 skill 也会出现在清单外：要留就写进 external。`;

function main(argv) {
  const home = homedir();
  const [cmd, ...rest] = argv;
  if (cmd === 'sync') {
    const manifest = readManifest();
    const prune = rest.includes('--prune') && rest.includes('--yes');
    const log = sync(home, manifest, { prune });
    if (rest.includes('--prune') && !prune) {
      const extra = strays(home, manifest);
      if (extra.length) log.push(`清单外 ${extra.length} 个（没动）：${extra.join(', ')}\n要移走就加 --yes；要留就写进 global/skills.json`);
    }
    console.log(log.length ? log.join('\n') : '已经一致');
  } else if (cmd === 'update') update(home, rest);
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
