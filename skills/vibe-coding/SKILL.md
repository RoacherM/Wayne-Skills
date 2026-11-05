---
name: vibe-coding
description: Wayne 的项目工程与文档规范：目录边界（code / test / dev / probe / bench）、活文档与接口设计（DESIGN.md / docs/subsystems / OpenAPI + Cloudflare Nimbus）、以及面向 Agent 自动开发、测试、Issue 跟踪与修复的 6 态闭环。在新建项目、整理仓库文档、编写或审计 AGENTS.md / DESIGN.md / docs/、或搭建自动 Issue 修复流程时使用。
---

# vibe-coding

一套让仓库同时对人和 Agent 保持高信噪比的工程规范。核心目标是：**杜绝过时计划与排查垃圾堆积，让 Agent 能脱离人工喂上下文，自动完成「认领 Issue → 复现（Red）→ 修复（Green）→ 验证与审查 → 更新活文档并结单」的闭环**。

**优先级**：仓库自己的 `AGENTS.md` 优先于本 Skill。本 Skill 在建仓、整仓、写/审文档或运行自动 Issue 循环时使用。

## 1. 目录边界（按「谁来启动、会碰到什么」划分）

| 目录 | 放什么 | 硬边界（The Boundary Test） |
|---|---|---|
| `<runtime>/` | 按进程/运行环境拆分的业务代码（如 `app/ host/ relay/ shared/`） | 纯逻辑与 I/O 外壳分离；读取/解析失败返回 `null`/`undefined`（未知），绝不返回 `[]`/`""`（空） |
| `test/` | `npm test` 直接跑的单测与契约测试 | **无需人工预启动任何服务即可通过**；只用临时实例与临时 `HOME`，绝不碰用户正在运行的服务、配置或剪贴板 |
| `dev/` | 需预启动外部依赖（本地中继、真机守护进程、无头浏览器）的 smoke / bench 脚本与假端 `fake-*.mjs` | 文件第 1 行写明前置条件 |
| `probe/` | 回答外部系统/二进制某个具体行为问题的一次性探针脚本 | 结论带**依赖版本号与日期**并入活文档；变成长期回归检查后移入 `dev/` |
| `bench/` | 跑分结果数据（如 `results.jsonl`） | 只放数据，跑分脚本放 `dev/` |
| `.scratch/` | 线上排查的 `.jsonl`/`.csv`、临时截图、一次性审计输出 | 必须加入 `.gitignore`，严禁塞进 `docs/` |

## 2. 文档分工（砍掉僵尸计划，严禁同模块多篇文档并存）

| 文件 / 目录 | 读者与用途 | 规则 |
|---|---|---|
| `README.md` | 给人看：一句话定位、架构图、安装/启动/测试命令 | 不重复抄 `DESIGN.md` 内部细节 |
| `AGENTS.md` (`CLAUDE.md` 指向它) | 给开发本仓库的 Agent 看（每次加载，**≤80 行**） | 写明目录边界、命令、6 条红线、**「改哪个目录 → 读哪篇活文档」路由表**、Issue 自动循环。严禁引用仓库外文件。模板见 [agents-template.md](references/agents-template.md) |
| `DESIGN.md`（小仓）或 `docs/subsystems/<module>.md`（大仓） | **唯一当前架构事实**（每个子系统只准有一篇） | 顶部带 Nimbus Frontmatter（`title` + `description`）。含当前结构、协议（含新旧端混用行为）、决定与理由、**本模块的坑**、**试过不做的方案**。代码注释用 `// DESIGN.md「章节」` 或 `// docs/subsystems/x.md#章节` 反指。模板见 [doc-and-api-template.md](references/doc-and-api-template.md) |
| `docs/decisions.md`（可选） | 已拍板的跨模块/跨仓硬约束（`D1..Dn`） | 只放拍板结论与理由，不放待办 |
| `docs/api/` + `site/`（有对外接口时） | `openapi.yaml`（OpenAPI 3.x）+ 可选 [Cloudflare Nimbus](https://github.com/cloudflare/nimbus) 文档站 | `servers` 必填 PROD 与 DEV 完整 URL；配零费用接口回归测试；用 Nimbus 同时生成 HTML 与 Agent 用的 `llms.txt` / `.md`。见 [doc-and-api-template.md](references/doc-and-api-template.md) |
| `docs/issues/` | **Agent 自动 Issue 队列**：`INDEX.md` + `I-<id>-<slug>.md` | 1 张卡片 = 1 个本仓库可独立 commit 的原子闭环；状态流转与模板见 [issue-tracker-template.md](references/issue-tracker-template.md) |
| `SKILL.md`（仅当仓库对外交付 CLI/工具时） | 给**使用该工具**的外部 Agent 看 | 只写怎么用工具；怎么开发本仓库写进 `AGENTS.md` |

- **跨仓库复用的底座坑**（如 `nsh`、`Herdr.app` 逆向细节）沉入对应底座的全局 Skill，不在每个业务仓重复抄。
- **删旧计划/排查报告前先分流**：已证实机制 → 并入 `DESIGN.md` 或 `docs/subsystems/*.md`；未做事项 → 拆成原子卡进 `docs/issues/`；原始数据 → `.scratch/` 或 `docs/archive/`（`AGENTS.md` 声明日常禁读 `docs/archive/`）。

## 3. Agent 自动开发 · 测试 · Issue 修复 5 步闭环

当用户指令或定时任务触发「处理 Issue / 推进开发」时，Agent 按以下状态机自主执行：

1. **选单（Pick）**：读 `docs/issues/INDEX.md`，只认领 `status: ready`（本仓可改、无需人工拍板、无需 PROD 写权限）的第一条 `I-<id>`。遇到 `needs-decision`、`external-blocked`、`ops-approval` 不硬改，只汇总向用户提问或请求授权。
2. **定位与复现（Red）**：只读该卡指定的 `subsystem` 活文档与目标源码；先写回归测试并运行 `verify` 命令，确认在旧代码上 **FAIL**。
3. **实现与自检（Green）**：最小化修改代码，确认回归测试 **PASS**，全量 `npm test` 通过，对改动文件跑 `ub-mode`（汇报 CRAP / dryer / mutator 数字）。
4. **按需独立审查（Gate）**：若改动触及**线协议、凭证、权限白名单/沙箱边界、持久化**或准备推向自动发布分支，调用不同于当前作者的模型审查 `git diff`；blocking 只认：**违反核心原则、丢数据、漏凭证、扩大权限边界**。
5. **原子提交与结单（Close）**：用 `git commit --only -- <本次改动路径>` 提交（不卷入工作区其它未完成改动）；同步更新对应活文档；在 `docs/issues/INDEX.md` 将该卡更新为 `verifying-dev` 或 `done`（写明 `commit SHA` 与测试路径），已 `done` 的单张 `I-<id>-*.md` 立即删除。

## 4. 自动文档与 Issue 巡检（`doc-lint`）

整理完文档或结单前，在仓库根目录运行检查脚本（支持 `--json` 供 Agent 自动修复）：

```bash
node <skill dir>/scripts/doc-lint.mjs [repo-root] [--json]
```
