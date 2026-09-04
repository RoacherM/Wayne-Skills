import { existsSync, readFileSync, renameSync, rmSync } from 'node:fs';
import YAML from 'yaml';
import { nowIso, parseTs, sortEvents } from './dates.ts';
import * as store from './store.ts';
import type { Event, Node } from './types.ts';
import { validateData } from './validate.ts';

interface OldGoal {
  id: string;
  name: string;
  area: string;
  kind: 'metric' | 'milestone' | 'habit';
  metric?: { unit: string; base: number; target: number };
  habit?: { times: number; per: 'week' };
  start: string;
  end?: string | null;
  weight?: number;
  status?: 'active' | 'done' | 'canceled' | 'frozen';
}

interface OldEvent {
  ts: string;
  goal: string;
  type: 'progress' | 'done' | 'blocked';
  scope?: string;
  value?: number;
  note: string;
}

export class MigrateError extends Error {
  errors: string[];
  constructor(errors: string[]) {
    super(errors.join('\n'));
    this.errors = errors;
  }
}

/**
 * goals.yaml + old events.jsonl → nodes.yaml + new events.jsonl. Old files are kept with a .migrated suffix.
 * Nothing is written unless the result validates clean; skipped events come back as warnings.
 */
export function migrate(): { nodes: Node[]; events: Event[]; warnings: string[] } {
  if (!existsSync(store.OLD_GOALS)) throw new Error(`没有 ${store.OLD_GOALS}，无需迁移`);
  if (store.exists()) throw new Error(`${store.NODES} 已存在，不会覆盖`);
  const goals = ((YAML.parse(readFileSync(store.OLD_GOALS, 'utf8')) ?? {}).goals ?? []) as OldGoal[];
  const old = existsSync(store.EVENTS)
    ? (readFileSync(store.EVENTS, 'utf8')
        .split('\n')
        .filter((l) => l.trim())
        .map((l) => JSON.parse(l)) as OldEvent[])
    : [];

  const nodes: Node[] = goals.map((g) => {
    const n: Node = { id: g.id, name: g.name, kind: g.kind, area: g.area, start: g.start };
    if (g.end) n.end = g.end;
    if (g.weight !== undefined) n.weight = g.weight;
    if (g.status === 'canceled' || g.status === 'frozen') n.status = g.status;
    if (g.kind === 'metric' && g.metric) {
      n.unit = g.metric.unit;
      n.from = g.metric.base;
      n.to = g.metric.target;
    }
    if (g.kind === 'habit') n.cadence = `${g.habit?.times ?? 1}/week`;
    return n;
  });

  const warnings: string[] = [];
  const events: Event[] = [];
  old.forEach((e, i) => {
    const at = `旧事件 #${i + 1}（${e.ts} ${e.goal} ${e.type}）`;
    const goal = goals.find((g) => g.id === e.goal);
    if (!goal) {
      warnings.push(`${at} 指向不存在的 goal，已跳过`);
      return;
    }
    const ts = parseTs(e.ts);
    if (!ts) {
      warnings.push(`${at} 时间无法解析，已跳过`);
      return;
    }
    if (goal.kind === 'habit' && e.type === 'blocked') {
      warnings.push(`${at} 习惯没有阻塞，已跳过`);
      return;
    }
    const type = goal.kind === 'habit' && e.type === 'progress' ? 'check' : e.type;
    const out: Event = { ts, rec: ts, node: e.goal, type, note: e.scope ? `${e.scope}: ${e.note}` : e.note };
    if (typeof e.value === 'number') out.value = e.value;
    events.push(out);
  });

  // goals marked done in the old file without a done event get one, dated at their last event
  for (const g of goals) {
    if (g.status !== 'done') continue;
    const own = sortEvents(events.filter((e) => e.node === g.id));
    if (own.some((e) => e.type === 'done')) continue;
    const ts = own.length ? own[own.length - 1].ts : (parseTs(g.end ?? g.start) ?? nowIso());
    events.push({ ts, rec: ts, node: g.id, type: 'done', note: '（迁移：旧 status: done）', confirmed: true });
  }
  const now = nowIso();
  events.push({ ts: now, rec: now, node: null, type: 'report', kind: 'daily', note: '迁移完成，作为 changes / commits 的初始锚点' });
  const sorted = sortEvents(events);

  const v = validateData(nodes, sorted);
  if (v.errors.length) throw new MigrateError(v.errors);
  warnings.push(...v.warnings);

  // The old events.jsonl shares its path with the new one, so it has to move first. Anything failing after
  // that point moves both old files back, so a half-done migration never leaves the directory unreadable.
  const hadEvents = existsSync(store.EVENTS);
  if (hadEvents) renameSync(store.EVENTS, store.EVENTS + '.migrated');
  renameSync(store.OLD_GOALS, store.OLD_GOALS + '.migrated');
  try {
    store.init();
    store.saveNodes(nodes);
    store.rewriteEvents(sorted);
  } catch (err) {
    try {
      if (existsSync(store.NODES)) rmSync(store.NODES);
      if (hadEvents) renameSync(store.EVENTS + '.migrated', store.EVENTS);
      else if (existsSync(store.EVENTS)) rmSync(store.EVENTS);
      renameSync(store.OLD_GOALS + '.migrated', store.OLD_GOALS);
    } catch {
      /* the original error is the one worth reporting */
    }
    throw err;
  }
  return { nodes, events: sorted, warnings };
}
