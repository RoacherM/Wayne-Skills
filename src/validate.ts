import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join, basename } from 'node:path';
import { isValidDate, isValidTs, isValidWeek, sortEvents, parseTs } from './dates.ts';
import { parseCadence } from './project.ts';
import * as store from './store.ts';
import type { Event, Node } from './types.ts';

const KINDS = new Set(['objective', 'metric', 'milestone', 'task', 'habit']);
const STATUSES = new Set(['active', 'canceled', 'frozen']);
const TYPES = new Set(['progress', 'done', 'blocked', 'claim', 'submit', 'reject', 'assess', 'change', 'plan', 'check', 'report']);
const PRIORITIES = new Set(['P0', 'P1', 'P2', 'P3']);

export interface Report {
  errors: string[];
  warnings: string[];
  merged?: MergeResult[];
}

export interface MergeResult {
  file: string;
  added: number;
  skipped: number;
  /** Non-empty means the file was left in place and nothing was written. */
  errors: string[];
}

/** Pure checks on the two data structures. */
export function validateData(nodes: Node[], events: Event[]): Report {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = new Map<string, Node>();
  for (const n of nodes) {
    if (!n.id) errors.push(`节点缺 id: ${JSON.stringify(n)}`);
    else if (ids.has(n.id)) errors.push(`id 重复: ${n.id}`);
    else ids.set(n.id, n);
  }
  for (const n of nodes) {
    const at = `节点 ${n.id}`;
    if (!n.name) errors.push(`${at} 缺 name`);
    if (!KINDS.has(n.kind)) errors.push(`${at} kind 非法: ${n.kind}`);
    if (n.status && !STATUSES.has(n.status)) errors.push(`${at} status 非法: ${n.status}`);
    if (n.parent && !ids.has(n.parent)) errors.push(`${at} parent 不存在: ${n.parent}`);
    for (const k of ['start', 'end', 'deadline'] as const) if (n[k] && !isValidDate(n[k]!)) errors.push(`${at} ${k} 不是日期: ${n[k]}`);
    if (n.start && n.end && n.end < n.start) errors.push(`${at} end 早于 start`);
    if (n.kind === 'metric') {
      if (typeof n.from !== 'number' || typeof n.to !== 'number') errors.push(`${at} metric 需要 from / to`);
      else if (n.from === n.to) errors.push(`${at} from 与 to 相等`);
    }
    if (n.kind === 'habit' && !parseCadence(n.cadence)) errors.push(`${at} cadence 非法: ${n.cadence}（N/week | daily | N/month）`);
    if (n.kind !== 'task') {
      for (const k of ['priority', 'deadline', 'deps', 'week', 'order', 'spec'] as const)
        if (n[k] !== undefined) warnings.push(`${at} 是 ${n.kind}，字段 ${k} 只对 task 有意义`);
    } else {
      if (n.priority && !PRIORITIES.has(n.priority)) errors.push(`${at} priority 非法: ${n.priority}`);
      if (n.week && !isValidWeek(n.week)) errors.push(`${at} week 非法: ${n.week}`);
      if (n.end !== undefined) warnings.push(`${at} task 用 deadline，不用 end`);
      for (const d of n.deps ?? []) {
        const dep = ids.get(d);
        if (!dep) errors.push(`${at} 依赖不存在: ${d}`);
        else if (d === n.id) errors.push(`${at} 依赖自己`);
        else if (dep.status === 'canceled') warnings.push(`${at} 依赖 ${d} 已取消，视为已满足`);
      }
    }
    const seen = new Set<string>([n.id]);
    let p = n.parent;
    while (p) {
      if (seen.has(p)) {
        errors.push(`${at} 的祖先链成环`);
        break;
      }
      seen.add(p);
      p = ids.get(p)?.parent;
    }
  }
  // deps cycles: a task waiting on itself through others would never become dispatchable
  const explored = new Set<string>();
  const reported = new Set<string>();
  const dfs = (id: string, path: string[]) => {
    if (explored.has(id)) return;
    const i = path.indexOf(id);
    if (i >= 0) {
      const cyc = path.slice(i);
      const key = [...cyc].sort().join(',');
      if (!reported.has(key)) {
        reported.add(key);
        errors.push(`依赖成环: ${[...cyc, id].join(' → ')}`);
      }
      return;
    }
    for (const d of ids.get(id)?.deps ?? []) if (d !== id) dfs(d, [...path, id]);
    explored.add(id);
  };
  for (const n of nodes) dfs(n.id, []);

  events.forEach((e, i) => {
    const at = `事件 #${i + 1}`;
    if (!TYPES.has(e.type)) errors.push(`${at} type 非法: ${e.type}`);
    if (!e.ts || !isValidTs(e.ts)) errors.push(`${at} ts 非法: ${e.ts}（要本地时间加数字时区，如 2026-09-03T20:45:12+08:00）`);
    else if (e.rec && !isValidTs(e.rec)) warnings.push(`${at} rec 格式不对: ${e.rec}`);
    if (e.type === 'plan' || e.type === 'report') {
      if (e.node) warnings.push(`${at} ${e.type} 事件不应有 node`);
    } else if (!e.node) errors.push(`${at} ${e.type} 缺 node`);
    else if (!ids.has(e.node)) (e.type === 'change' ? warnings : errors).push(`${at} node 不存在: ${e.node}${e.type === 'change' ? '（已删除节点的变更记录）' : ''}`);
    if (e.type === 'assess' && !e.note) errors.push(`${at} assess 缺理由`);
    if (e.type === 'submit' && !e.links?.length) errors.push(`${at} submit 缺 links`);
  });
  return { errors, warnings };
}

const EVENT_COPY = /^events \d+\.jsonl$/;

/** File-level checks in OKR_DIR: iCloud placeholders, conflict copies, git health. Read-only. */
export function validateDir(): Report {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!existsSync(store.DIR)) return { errors: [`目录不存在: ${store.DIR}`], warnings };
  for (const f of readdirSync(store.DIR)) {
    if (f.endsWith('.icloud')) errors.push(`iCloud 占位文件（内容未下载）: ${f}`);
    if (/ \d+\.(yaml|jsonl)$/.test(f)) {
      if (EVENT_COPY.test(f)) errors.push(`iCloud 冲突副本: ${f}（validate --merge-events 可并入）`);
      else errors.push(`iCloud 冲突副本: ${f}（需手工比对后删除）`);
    }
  }
  if (existsSync(store.EVENTS)) {
    readFileSync(store.EVENTS, 'utf8')
      .split('\n')
      .forEach((l, i) => {
        if (!l.trim()) return;
        try {
          JSON.parse(l);
        } catch {
          errors.push(`events.jsonl 第 ${i + 1} 行不是合法 JSON`);
        }
      });
  }
  if (existsSync(join(store.DIR, '.git'))) {
    try {
      store.git(['fsck', '--no-dangling', '--no-progress']);
    } catch (err) {
      errors.push(`git fsck 失败: ${firstLine(err)}`);
    }
    try {
      const st = store.git(['status', '--porcelain']).trim();
      if (st) errors.push(`git 工作区不干净（有静默失败的 commit？）:\n${st}`);
    } catch (err) {
      errors.push(`git status 失败: ${firstLine(err)}`);
    }
  } else warnings.push('没有 .git，没有历史备份');
  return { errors, warnings };
}

/**
 * Fold every `events N.jsonl` conflict copy into events.jsonl. Caller holds the write lock and commits.
 * A copy with unparseable lines, or whose merge would not validate, is reported and left untouched.
 */
export function mergeEventFiles(): MergeResult[] {
  if (!existsSync(store.DIR)) return [];
  return readdirSync(store.DIR)
    .filter((f) => EVENT_COPY.test(f))
    .sort()
    .map((f) => mergeEventFile(join(store.DIR, f)));
}

function firstLine(err: unknown): string {
  return String((err as Error).message).split('\n')[0];
}

function mergeEventFile(path: string): MergeResult {
  const name = basename(path);
  const errors: string[] = [];
  const extra: Event[] = [];
  readFileSync(path, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      if (!line.trim()) return;
      let e: Event;
      try {
        e = JSON.parse(line) as Event;
      } catch (err) {
        errors.push(`${name} 第 ${i + 1} 行不是合法 JSON: ${firstLine(err)}`);
        return;
      }
      if (!e || typeof e !== 'object' || typeof e.ts !== 'string') {
        errors.push(`${name} 第 ${i + 1} 行缺 ts`);
        return;
      }
      // copies may carry Z or foreign offsets; the main file only accepts local time
      const ts = parseTs(e.ts);
      if (!ts) {
        errors.push(`${name} 第 ${i + 1} 行 ts 无法解析: ${e.ts}`);
        return;
      }
      e.ts = ts;
      if (typeof e.rec === 'string') e.rec = parseTs(e.rec) ?? ts;
      else e.rec = ts;
      extra.push(e);
    });
  if (errors.length) return { file: path, added: 0, skipped: 0, errors };

  const main = store.loadEvents();
  const key = (e: Event) => `${e.ts} ${e.node ?? ''} ${e.type} ${e.note}`;
  const have = new Set(main.map(key));
  let added = 0;
  let skipped = 0;
  for (const e of extra) {
    if (have.has(key(e))) skipped++;
    else {
      main.push(e);
      have.add(key(e));
      added++;
    }
  }
  const merged = sortEvents(main);
  // Errors carry the event's position in the main file, which shifts once copies are inserted; compare without it.
  const bare = (x: string) => x.replace(/^事件 #\d+ /, '');
  const nodes = store.loadNodes();
  const before = new Set(validateData(nodes, main.slice(0, main.length - added)).errors.map(bare));
  const fresh = validateData(nodes, merged).errors.map(bare).filter((x) => !before.has(x));
  if (fresh.length) return { file: path, added: 0, skipped: 0, errors: fresh.map((x) => `${name} 并入后: ${x}`) };
  store.rewriteEvents(merged);
  rmSync(path);
  return { file: path, added, skipped, errors: [] };
}
