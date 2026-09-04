import type { Event, Node } from './types.ts';

export const DEMO_TODAY = '2026-09-03';

export const DEMO_NODES: Node[] = [
  { id: 'o1', name: '推荐系统二期上线', kind: 'objective', area: '工作', start: '2026-07-01', end: '2026-09-30' },
  { id: 'kr1', name: '推荐模型精度', kind: 'metric', parent: 'o1', unit: '%', from: 76, to: 95, start: '2026-07-01', end: '2026-09-30', weight: 2 },
  { id: 'kr1.1', name: '特征工程 v2', kind: 'task', parent: 'kr1', priority: 'P1', week: '2026-W34' },
  {
    id: 'kr1.2',
    name: '用户分群特征',
    kind: 'task',
    parent: 'kr1',
    priority: 'P1',
    deadline: '2026-09-05',
    week: '2026-W36',
    order: 1,
    spec: {
      goal: '在 recsys 仓库 features/ 下加入用户分群特征，不动线上打分服务',
      accept: ['离线 AUC 提升 ≥ 0.5pt', '特征回填脚本可重跑', '新增特征有单测'],
      verify: 'make test && make eval',
      links: ['https://github.com/acme/recsys/issues/412'],
    },
  },
  {
    id: 'kr1.3',
    name: '特征 v3：实时序列',
    kind: 'task',
    parent: 'kr1',
    priority: 'P2',
    deadline: '2026-09-12',
    deps: ['kr1.2'],
    week: '2026-W36',
    order: 2,
    spec: {
      goal: '接入实时行为序列特征，只改 features/ 和 train/，不动 serving',
      accept: ['序列特征在训练集覆盖率 > 90%', '训练耗时增加 < 20%'],
      verify: 'make test',
      links: ['docs/design/seq-features.md'],
    },
  },
  { id: 'm1', name: '数据平台上线', kind: 'milestone', parent: 'o1', start: '2026-07-15', end: '2026-09-20' },
  { id: 'm1.1', name: '打通数据团队接口', kind: 'task', parent: 'm1', priority: 'P0', deadline: '2026-09-01', week: '2026-W35' },
  { id: 'm1.2', name: '灰度发布方案', kind: 'task', parent: 'm1', priority: 'P1', week: '2026-W35', spec: { goal: '写灰度方案文档', accept: ['评审通过'] } },
  { id: 'm1.3', name: '监控看板', kind: 'task', parent: 'm1', priority: 'P2' },
  { id: 'kr2', name: '今年读完 12 本书', kind: 'metric', area: '成长', unit: '本', from: 0, to: 12, start: '2026-01-01', end: '2026-12-31' },
  { id: 'h1', name: '每周跑步三次', kind: 'habit', area: '健康', cadence: '3/week', start: '2026-07-01' },
  { id: 't1', name: '续签域名', kind: 'task', area: '杂务', priority: 'P3', deadline: '2026-09-04', week: '2026-W36', order: 3 },
  { id: 'o0', name: '旧项目收尾', kind: 'objective', area: '工作', status: 'canceled', start: '2026-05-01', end: '2026-06-30' },
];

const T = (d: string) => `${d}T10:00:00+08:00`;
const ev = (d: string, node: string | null, type: Event['type'], note: string, extra: Partial<Event> = {}): Event => ({
  ts: T(d),
  rec: T(d),
  node,
  type,
  note,
  by: 'claude',
  ...extra,
});

export const DEMO_EVENTS: Event[] = [
  ev('2026-07-01', null, 'report', '初始化', { kind: 'daily', by: undefined }),
  ev('2026-07-08', 'kr1', 'progress', '基线跑通', { value: 76 }),
  ev('2026-07-20', 'kr1.1', 'progress', '特征清单确定'),
  ev('2026-08-05', 'kr1.1', 'progress', '特征工程 v2 训练完成'),
  ev('2026-08-06', 'kr1', 'progress', 'v2 特征上线离线评测', { value: 82 }),
  ev('2026-08-14', 'kr1.1', 'done', 'v2 合入主干', { links: ['https://github.com/acme/recsys/pull/398'] }),
  ev('2026-08-20', 'm1.1', 'progress', '接口文档评审'),
  ev('2026-08-25', 'm1.1', 'blocked', '等数据团队开接口权限'),
  ev('2026-08-26', 'kr1.2', 'claim', '领取', { by: 'codex', session: 'wt-userseg' }),
  ev('2026-08-28', 'kr1.2', 'progress', '分群特征回填完成，AUC +0.6', { by: 'codex', session: 'wt-userseg' }),
  ev('2026-08-31', 'kr1', 'progress', '分群特征离线评测', { value: 86 }),
  ev('2026-08-31', 'kr1.2', 'submit', 'PR 已提', { by: 'codex', session: 'wt-userseg', links: ['https://github.com/acme/recsys/pull/421'] }),
  ev('2026-09-01', 'o1', 'assess', 'kr1 已到 86，m1 被接口卡住两周，整体略落后', { value: 45, derived: 41 }),
  ev('2026-09-01', null, 'plan', '2026-W36 计划落地', { source: '2026-W36.plan.yaml', confirmed: true }),
  ev('2026-09-02', 'kr2', 'progress', '读完《系统之美》', { value: 7 }),
  ev('2026-07-02', 'h1', 'check', '晨跑 5km'), ev('2026-07-04', 'h1', 'check', '晨跑'), ev('2026-07-06', 'h1', 'check', '夜跑'),
  ev('2026-07-08', 'h1', 'check', '晨跑'), ev('2026-07-10', 'h1', 'check', '晨跑'), ev('2026-07-13', 'h1', 'check', '长跑 10km'),
  ev('2026-07-15', 'h1', 'check', '晨跑'), ev('2026-07-17', 'h1', 'check', '晨跑'),
  ev('2026-07-22', 'h1', 'check', '晨跑'), ev('2026-07-25', 'h1', 'check', '晨跑'), ev('2026-07-26', 'h1', 'check', '夜跑'),
  ev('2026-08-03', 'h1', 'check', '晨跑'), ev('2026-08-05', 'h1', 'check', '晨跑'), ev('2026-08-08', 'h1', 'check', '晨跑'),
  ev('2026-08-11', 'h1', 'check', '晨跑'), ev('2026-08-13', 'h1', 'check', '晨跑'), ev('2026-08-15', 'h1', 'check', '长跑'),
  ev('2026-08-18', 'h1', 'check', '晨跑'), ev('2026-08-21', 'h1', 'check', '晨跑'), ev('2026-08-23', 'h1', 'check', '晨跑'),
  ev('2026-08-25', 'h1', 'check', '晨跑'), ev('2026-08-27', 'h1', 'check', '晨跑'),
  ev('2026-09-01', 'h1', 'check', '晨跑'),
];
