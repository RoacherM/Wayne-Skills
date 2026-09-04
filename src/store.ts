import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { sortEvents } from './dates.ts';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import YAML from 'yaml';
import type { Event, Node, Repo } from './types.ts';

export const DIR = process.env.OKR_DIR ?? join(homedir(), '.okr');
export const NODES = join(DIR, 'nodes.yaml');
export const EVENTS = join(DIR, 'events.jsonl');
export const REPOS = join(DIR, 'repos.yaml');
export const REPORTS = join(DIR, 'reports');
export const LOGS = join(DIR, 'logs');
/** Old layout, read only by migrate. */
export const OLD_GOALS = join(DIR, 'goals.yaml');

const GITIGNORE = ['# iCloud conflict copies and job logs never enter history', '* [0-9].*', 'logs/', ''].join('\n');

export function exists(): boolean {
  return existsSync(NODES);
}

export function hasOldLayout(): boolean {
  return existsSync(OLD_GOALS) && !existsSync(NODES);
}

export function init(): { created: boolean } {
  if (exists()) return { created: false };
  mkdirSync(REPORTS, { recursive: true });
  mkdirSync(LOGS, { recursive: true });
  writeFileSync(NODES, YAML.stringify({ nodes: [] }));
  if (!existsSync(EVENTS)) writeFileSync(EVENTS, '');
  if (!existsSync(REPOS)) writeFileSync(REPOS, YAML.stringify({ repos: [] }));
  writeFileSync(join(DIR, '.gitignore'), GITIGNORE);
  if (!existsSync(join(DIR, '.git'))) git(['init', '-q', '-b', 'main']);
  commit('init: okr tracking');
  return { created: true };
}

export function loadNodes(): Node[] {
  if (!exists()) return [];
  const doc = YAML.parse(readFileSync(NODES, 'utf8')) ?? {};
  return (doc.nodes ?? []) as Node[];
}

/** Whole-file replace via temp + rename so a reader never sees a half-written tree. */
export function saveNodes(nodes: Node[]): void {
  atomicWrite(NODES, YAML.stringify({ nodes: nodes.map(cleanNode) }));
}

function cleanNode(n: Node): Node {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(n)) if (v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0)) out[k] = v;
  if (n.end === null) out.end = null;
  return out as unknown as Node;
}

export function loadEvents(): Event[] {
  if (!existsSync(EVENTS)) return [];
  return sortEvents(
    readFileSync(EVENTS, 'utf8')
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as Event),
  ); // by instant; same instant keeps append order
}

export function appendEvent(e: Event): void {
  appendFileSync(EVENTS, JSON.stringify(e) + '\n');
}

export function rewriteEvents(events: Event[]): void {
  atomicWrite(EVENTS, events.map((e) => JSON.stringify(e)).join('\n') + (events.length ? '\n' : ''));
}

export function loadRepos(): Repo[] {
  if (!existsSync(REPOS)) return [];
  const doc = YAML.parse(readFileSync(REPOS, 'utf8')) ?? {};
  return (doc.repos ?? []) as Repo[];
}

export function saveRepos(repos: Repo[]): void {
  atomicWrite(REPOS, YAML.stringify({ repos }));
}

function atomicWrite(path: string, content: string): void {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, content);
  renameSync(tmp, path);
}

// ── lock ───────────────────────────────────────────────
// Node has no flock; an exclusive-create file with the holder's pid gives the same property
// we need: it lives in the local temp dir, never in iCloud, and a dead holder is detected.

export class LockTimeout extends Error {}

const lockPath = () => join(tmpdir(), `okr-${createHash('sha1').update(DIR).digest('hex').slice(0, 12)}.lock`);

/** Callers must not `process.exit` inside `fn`: the lock is released by the finally, which only runs when `fn` returns or throws. */
export function withLock<T>(fn: () => T, timeoutMs = 5000): T {
  const path = lockPath();
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const fd = openSync(path, 'wx');
      writeFileSync(fd, String(process.pid));
      closeSync(fd);
      break;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
      let pid = 0;
      let age = 0;
      try {
        pid = Number(readFileSync(path, 'utf8').trim()) || 0;
        age = Date.now() - statSync(path).mtimeMs;
      } catch (e2) {
        if ((e2 as NodeJS.ErrnoException).code === 'ENOENT') continue; // released between our open and read
        throw e2;
      }
      // dead holder, or a file whose holder died between create and pid write
      if ((pid && !alive(pid)) || (!pid && age > 2000)) {
        reclaim(path);
        continue;
      }
      if (Date.now() > deadline) throw new LockTimeout(`另一个 okr 进程（pid ${pid || '?'}）持有写锁超过 ${timeoutMs / 1000}s`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
  try {
    return fn();
  } finally {
    rmSync(path, { force: true });
  }
}

/** Rename first so two reclaimers cannot both delete: only one rename succeeds, the other loops and finds the new lock. */
function reclaim(path: string): void {
  const stale = `${path}.${process.pid}.stale`;
  try {
    renameSync(path, stale);
    rmSync(stale, { force: true });
  } catch {
    /* someone else got there first */
  }
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

// ── git ────────────────────────────────────────────────
/** Commit the data files. Git is history and backup only; state is always derived from the files. */
export function commit(msg: string): { committed: boolean; error?: string } {
  if (!existsSync(join(DIR, '.git'))) return { committed: false, error: 'no .git' };
  try {
    git(['add', '-A']);
    if (!git(['status', '--porcelain']).trim()) return { committed: true };
    git(['commit', '-q', '-m', msg]);
    return { committed: true };
  } catch (err) {
    return { committed: false, error: String((err as Error).message).split('\n')[0] };
  }
}

export function git(args: string[]): string {
  return execFileSync('git', ['-C', DIR, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
