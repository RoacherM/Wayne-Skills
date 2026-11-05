# Agent 自动 Issue 跟踪与修复模板（`docs/issues/`）

为了让 Agent 能够自主完成「挑选任务 → 复现（Red）→ 修复（Green）→ 验证 → 结单」，严禁把多个跨仓问题、待拍板问题和半成品混写成一篇长篇调查报告。

所有待办与问题统一存放在 `docs/issues/` 下：
- `docs/issues/INDEX.md`：全局状态看板（人机共读，≤100 行）。
- `docs/issues/I-<三位编号>-<slug>.md`：**未结**原子工单卡片（1 张卡 = 1 个本仓库可独立 commit、独立测试的闭环）。**一旦状态变为 `done`，把结单信息记入 `INDEX.md` 底部后立即 `git rm` 删除该单卡文件**，保持 `docs/issues/` 永远只有当前活跃项。

---

## 1. 六种标准状态（State Machine）

| 状态 | 含义 | Agent 行为 |
|---|---|---|
| `ready` | **本仓库可独立完成**，根因与方案明确，无需人工拍板，无需写生产库 | **Agent 自动按优先级认领并修复** |
| `in_progress` | 正在由某个分支/会话修改中 | 避免重复认领；严禁留半成品在脏工作区结束会话 |
| `needs-decision` | 存在产品/架构取舍，需要用户拍板 | **不写代码**；向用户展示选项 A / B 与影响，用户拍板后改为 `ready` |
| `external-blocked` | 改动在其它仓库（如 `storyforge-skills`、`argocd-config`、上游网关） | 在卡内写明外部仓库、文件与建议改法；外部合入后再推进本仓 |
| `ops-approval` | 脚本/代码已就绪，但需执行生产环境写操作（如清理 PROD 死行、迁数据） | 附上完整命令与影响范围，等用户明确授权后再执行 |
| `verifying-dev` | 本仓代码已提交（含 `commit` 与回归测试），等 DEV/集群环境验证 | 单机项目跳过此态直接进 `done`；集群项目验证通过后进 `done` |
| `done` | 已闭环 | 写入 `INDEX.md`「最近已完成」表（含 `commit SHA` + 测试文件），**删除单张 `I-xxx.md`** |

---

## 2. `docs/issues/INDEX.md` 模板

```markdown
---
title: Issue 与待优化项队列
description: 面向 Agent 自动开发、测试与修复的 6 态原子任务看板。
---

# Issue 队列

Agent 自动处理规则：只认领 `ready` 栏的条目；修完用 `git commit --only -- <paths>` 提交，更新对应活文档，将条目移入 `verifying-dev` 或 `done` 并删除已 `done` 的单张卡片文件。

## 1. Ready（Agent 可直接认领）

| ID | 优先级 | 子系统 | 标题 | 验证命令 |
|---|---|---|---|---|
| [I-001](I-001-example.md) | P0 | `video-task` | 事件流 30 分钟总超时改为基于 ping 的空闲超时 | `node --test tests/video-task-worker.test.mjs` |

## 2. Needs Decision（等用户拍板）

| ID | 子系统 | 需拍板问题 | 选项与推荐 |
|---|---|---|---|
| [I-002](I-002-image-budget.md) | `chatui` | 单会话图片压缩阈值与张数上限 | A: 350KB/60张（推荐）；B: 200KB/80张 |

## 3. External Blocked / Ops Approval（跨仓阻塞或需生产授权）

| ID | 类型 | 阻塞方 / 需授权操作 | 说明 |
|---|---|---|---|
| [I-003](I-003-sendback-export.md) | `external-blocked` | `storyforge-skills` (`finish.py:221`) | `export` 需写入 `sent` 计数 |
| [I-004](I-004-prod-dead-rows.md) | `ops-approval` | PROD `storyforge_video_tasks` | 清理 54 条永久 `reconciling` 死行 |

## 4. Verifying（已提交，待环境核验）

| ID | 子系统 | 标题 | Commit | 回归测试 |
|---|---|---|---|---|

## 5. Done（已闭环，单卡已删）

| ID | 子系统 | 标题 | Commit | 回归测试 | 日期 |
|---|---|---|---|---|---|
```

---

## 3. 单张原子工单 `docs/issues/I-<编号>-<slug>.md` 模板（≤40 行）

```markdown
---
id: I-001
title: 事件流 30 分钟总超时改为基于 ping 的空闲超时
status: ready
priority: P0
subsystem: docs/subsystems/video-task.md
repo: self
files:
  - host/video-task-worker.mjs
  - tests/video-task-worker.test.mjs
verify: node --test tests/video-task-worker.test.mjs
---

## 现象与根因（已核实）
`host/video-task-worker.mjs:540` 用 30 分钟（`:167`）做事件流总超时；生产 p50 为 32 分钟、p90 为 60.5 分钟，长任务被误推入 `reconciling`。

## 修复方案
将总超时改为基于 ChatUI 25 秒 ping 的空闲超时；流断开后用原 SID 重连。

## 验收条件（Red → Green）
- [ ] 在 `tests/video-task-worker.test.mjs` 新增测试：持续有 ping 超过 30 分钟的流不触发超时（旧代码 FAIL，新代码 PASS）。
- [ ] `npm test` 全部通过。
- [ ] 同步更新 `docs/subsystems/video-task.md` 的超时说明。
```
