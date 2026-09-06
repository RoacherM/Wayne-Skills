export type NodeKind = 'objective' | 'metric' | 'milestone' | 'task' | 'habit';
export type NodeStatus = 'active' | 'canceled' | 'frozen';
export type Priority = 'P0' | 'P1' | 'P2' | 'P3';

/** Dispatch spec. All four filled means an agent can take the task without asking. */
export interface Spec {
  goal?: string;
  accept?: string[];
  verify?: string;
  links?: string[];
}

export interface Node {
  id: string;
  name: string;
  kind: NodeKind;
  parent?: string | null;
  area?: string;
  status?: NodeStatus;
  start?: string; // YYYY-MM-DD
  end?: string | null; // objective / metric / milestone
  weight?: number; // default 1
  // metric
  unit?: string;
  from?: number;
  to?: number;
  // habit: "3/week" | "daily" | "4/month"
  cadence?: string;
  // task
  priority?: Priority;
  deadline?: string;
  deps?: string[];
  week?: string; // 2026-W36, the only truth for "planned this week"
  order?: number;
  spec?: Spec;
}

export type EventType =
  | 'progress'
  | 'done'
  | 'blocked'
  | 'claim'
  | 'submit'
  | 'reject'
  | 'assess'
  | 'change'
  | 'plan'
  | 'check'
  | 'report';

/** The six event types that move a task through its stages. */
export const STAGE_EVENTS: ReadonlySet<EventType> = new Set(['progress', 'done', 'blocked', 'claim', 'submit', 'reject']);

export interface Event {
  ts: string; // when it happened, ISO with offset
  rec: string; // when it was written, ISO with offset
  node?: string | null; // empty for plan / report
  type: EventType;
  note: string;
  body?: string;
  value?: number;
  hours?: number;
  links?: string[];
  by?: string;
  session?: string;
  repo?: string;
  commit?: string;
  confirmed?: boolean;
  derived?: number; // assess: derived progress as a percent (0..100) at the time; `value` is a percent too
  kind?: 'daily' | 'weekly'; // report
  dismissed?: boolean; // plan
  source?: string; // plan: file it came from
  week?: string; // plan: the week the proposal was for
}

export type Stage = 'todo' | 'doing' | 'blocked' | 'review' | 'done';
export type Health = 'on-track' | 'at-risk' | 'behind' | 'done' | 'blocked' | 'idle' | 'frozen' | 'canceled';
export type Flag = 'overdue' | 'due-soon' | 'blocked' | 'stale' | 'review-stale' | 'claimed' | 'carry-over';

export interface HabitStats {
  period: 'day' | 'week' | 'month';
  times: number; // required per period
  thisPeriod: number;
  streak: number; // consecutive periods met, counting the current one if already met
  total: number;
  days: Set<string>;
}

export interface Assess {
  value: number; // 0..1
  ts: string;
  derived: number | null;
  note: string;
  stale: boolean;
}

export interface NodeState {
  node: Node;
  parent: NodeState | null;
  children: NodeState[];
  depth: number;
  /** Own status, or the nearest canceled / frozen ancestor's: canceled wins over frozen, both over active. */
  effective: NodeStatus;
  events: Event[]; // own events, by ts
  stage: Stage;
  /** Progress from children / metric value, 0..1; null when nothing to derive from. */
  derived: number | null;
  assess: Assess | null;
  /** What views and health use: assess when fresh, else derived. */
  progress: number | null;
  current: number | null; // metric value
  elapsed: number | null; // 0..1 of own period
  health: Health;
  flags: Flag[];
  last: Event | null; // own last event
  lastInTree: Event | null; // latest event anywhere in the subtree
  daysSinceLast: number | null;
  blocked: { since: string; note: string } | null;
  claimed: { by: string; session?: string; ts: string } | null;
  planned: boolean;
  carryOver: boolean;
  dispatchable: boolean;
  undecomposed: number; // children with null progress
  habit?: HabitStats;
}

export interface Repo {
  path: string;
  node?: string;
}

export const KIND_LABEL: Record<NodeKind, string> = {
  objective: '目标',
  metric: '指标',
  milestone: '里程碑',
  task: '任务',
  habit: '习惯',
};

export const STAGE_LABEL: Record<Stage, string> = {
  todo: '待办',
  doing: '进行中',
  blocked: '阻塞',
  review: '待验收',
  done: '完成',
};
