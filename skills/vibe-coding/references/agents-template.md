# `AGENTS.md` 极简仓库模板（建议 50 行内）

通用编码品味、分层验证、评审与 Issue 闭环统一由全局 `vibe-coding` 与 `ub-mode` Skill 承载，**不要再往仓库 `AGENTS.md` 里复制通用工程套话**。仓库根目录 `AGENTS.md`（`CLAUDE.md` 写 `@AGENTS.md`）只写本仓库独有的目录职责、省时间的快检命令、文档路由与真实踩坑记录。

````markdown
# <repo-name>

<一句话说明本仓库做什么、边界在哪里。>

## 1. 目录边界

| 目录 | 职责与放入判断标准 |
|---|---|
| `<dir-a>/` | ... |
| `test/` | 免预启动单测（临时实例与临时 HOME，秒级跑通） |
| `dev/` | 需外部前置条件的 smoke / bench / fake 脚本（见文件首行说明） |

## 2. 常用命令（开发迭代优先跑静态快检 + 单文件测试）

```sh
oxlint <changed-files>                        # JS/TS 毫秒级静态与坏味道检查（Python 用 ruff check，Shell 用 shellcheck）
node --test test/<target>.test.mjs            # 单文件快检（迭代中途跑这个，不跑全量）
npm test                                      # 全量免准备单测（集成完成后跑一次）
scripts/review.sh precheck <id> main HEAD     # 预检并冻结评审包（bug 修复加 --fix）
```

## 3. 按任务读文档

- 架构与协议事实：`DESIGN.md`（或 `docs/subsystems/<module>.md`）
- 对外接口契约：`docs/api/openapi.yaml`
- 待办队列：`docs/issues/INDEX.md`（日常开发不读 `docs/archive/`）

## 4. 本仓硬约束与教训

- <只写本仓特有的不可破约束：如实时守护进程不可重启、持久化 key / 线协议兼容要求、构建同步命令等>
- <!-- 本仓踩过的坑按「情境 → 做法 → 原因（含依赖版本与日期）」一行一条记在这里 -->
````
