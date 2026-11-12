---
name: vibe-coding
description: Wayne 的项目工程与开发规范：目录边界（code / test / dev / probe / bench）、仓库开发规范模板、活文档与接口设计（DESIGN.md / docs/subsystems / OpenAPI + Cloudflare Nimbus）、统一评审规则（按完整功能审一次），以及面向 Agent 自动开发、测试、Issue 跟踪与修复的 5 步闭环（配 7 态 Issue 队列）。在新建项目、整理仓库文档、编写或审计 AGENTS.md / DESIGN.md / docs/、执行独立代码评审或搭建自动 Issue 修复流程时使用。
---

# vibe-coding

一套让仓库同时对人和 Agent 保持高信噪比的工程规范。核心目标是：**避免过时计划与排查记录堆积，让 Agent 能脱离人工喂上下文，自动完成「认领 Issue → 复现（Red）→ 修复（Green）→ 验证与审查 → 更新活文档并结单」的闭环**。

**优先级**：除「统一评审规则」外，仓库自己的 `AGENTS.md` 优先于本 Skill。仓库文档只写本仓评审参数，不另立别的评审流程，避免各仓叠加关卡把同一段代码审多遍。本 Skill 在建仓、整仓、写/审文档、代码评审或运行自动 Issue 循环时使用。

## 1. 目录边界（按「谁来启动、会碰到什么」划分）

| 目录 | 放什么 | 边界与原因（The Boundary Test） |
|---|---|---|
| `<runtime>/` | 按进程/运行环境拆分的业务代码（如 `app/ host/ relay/ shared/`） | 纯逻辑与 I/O 外壳分离；读取或解析失败时返回 `null`/`undefined` 表示「未知」，不返回 `[]`/`""`，以免调用方把故障误判为空数据 |
| `test/` | `npm test` 直接跑的单测与契约测试 | **无需人工预启动服务即可通过**；只用临时实例与临时 `HOME`，不读写用户正在运行的服务、配置或剪贴板，避免污染本机环境或打断用户工作 |
| `dev/` | 需预启动外部依赖（本地中继、真机守护进程、无头浏览器）的 smoke / bench 脚本与假端 `fake-*.mjs` | 在文件开头写明前置条件（需启动哪些服务或环境变量），避免误当免准备单测直接跑挂 |
| `probe/` | 回答外部系统/二进制某个具体行为问题的一次性探针脚本 | 结论带**依赖版本号与日期**并入活文档（外部行为会随版本变化）；变成长期回归检查后移入 `dev/` |
| `bench/` | 跑分结果数据（如 `results.jsonl`） | 只放数据，跑分脚本放 `dev/`，方便对比历次基线而不混入外部运行依赖 |
| `.scratch/` | 线上排查的 `.jsonl`/`.csv`、临时截图、一次性审计输出 | 加入 `.gitignore`，不放进 `docs/`，以免一次性排查产物混入活文档干扰检索 |

## 2. 文档分工（每个模块维护一篇当前活文档，避免多份说法打架）

| 文件 / 目录 | 读者与用途 | 规则 |
|---|---|---|
| `README.md` | 给人看：一句话定位、架构图、安装/启动/测试命令 | 不重复抄 `DESIGN.md` 内部细节，减少两处同步负担 |
| `AGENTS.md` (`CLAUDE.md` 指向它) | 给开发本仓库的 Agent 看（每次会话加载，建议 80 行内以省常驻上下文） | 写明目录边界、常用命令、**「改哪类内容 → 读哪篇活文档」路由**、Issue 自动循环；初始化项目时把模板 [agents-template.md](references/agents-template.md) 的「开发规范」一节带进项目。不依赖本机私有路径（全局 Skill 除外），保证换机器或进容器也能读懂 |
| `DESIGN.md`（小仓）或 `docs/subsystems/<module>.md`（大仓） | **唯一当前架构事实**（每个子系统维护一篇） | 顶部带 Nimbus Frontmatter（`title` + `description`），供快速路由与生成索引。含当前结构、协议（含新旧端混用行为）、决定与理由、**本模块的坑**、**试过不做的方案**。代码注释用 `// DESIGN.md「章节」` 或 `// docs/subsystems/x.md#章节` 反指。模板见 [doc-and-api-template.md](references/doc-and-api-template.md) |
| `docs/decisions.md`（可选） | 已拍板的跨模块/跨仓硬约束（`D1..Dn`） | 只放拍板结论、原因与被否掉的选项，不放待办，以免未定事项被误当成已定约束 |
| `docs/api/` + `site/`（有对外接口时） | `openapi.yaml`（OpenAPI 3.x）+ 可选 [Cloudflare Nimbus](https://github.com/cloudflare/nimbus) 文档站 | `servers` 列出 PROD 与 DEV 完整 URL（省去对接方猜地址）；配零费用接口回归测试；用 Nimbus 同时生成 HTML 与 Agent 用的 `llms.txt` / `.md`。见 [doc-and-api-template.md](references/doc-and-api-template.md) |
| `docs/issues/` | **Agent 自动 Issue 队列**：`INDEX.md` + `I-<id>-<slug>.md` | 1 张卡片 = 1 个本仓库可独立 commit 的原子闭环；状态流转与模板见 [issue-tracker-template.md](references/issue-tracker-template.md) |
| `SKILL.md`（仅当仓库对外交付 CLI/工具时） | 给**使用该工具**的外部 Agent 看 | 只写怎么用工具；怎么开发本仓库写进 `AGENTS.md` |

- **跨仓库复用的底座坑**（如 `nsh`、`Herdr.app` 逆向细节）沉入对应底座的全局 Skill，不在每个业务仓重复抄。
- **删旧计划/排查报告前先分流**：已证实机制 → 并入 `DESIGN.md` 或 `docs/subsystems/*.md`；未做事项 → 拆成原子卡进 `docs/issues/`；原始数据 → `.scratch/` 或 `docs/archive/`（`AGENTS.md` 注明日常开发不读 `docs/archive/`，只在追溯历史背景或用户要求时查阅，免得过期方案干扰当前实现）。

## 3. Agent 自动开发 · 测试 · Issue 修复 5 步闭环

当用户指令或定时任务触发「处理 Issue / 推进开发」时，Agent 按以下状态机自主执行：

1. **选单（Pick）**：读 `docs/issues/INDEX.md`，只认领 `status: ready`（本仓可改、无需人工拍板、无需 PROD 写权限）的第一条 `I-<id>`。遇到 `needs-decision`、`external-blocked`、`ops-approval` 不硬改，只汇总向用户提问或请求授权。
2. **定位与复现（Red）**：只读该卡指定的 `subsystem` 活文档与目标源码；先写回归测试并运行 `verify` 命令，确认在旧代码上 **FAIL**。
3. **实现与自检（Green）**：最小化修改代码，确认回归测试 **PASS**，全量 `npm test` 通过，对改动文件跑 `ub-mode`（汇报 CRAP / dryer / mutator 数字）。
4. **按需独立审查（Gate）**：机器检查全过后，按下方「统一评审规则」执行：完整功能或重构在完成时对全量 diff 审一次；带复现测试的 bug 修复（已走完第 2–3 步先红后绿）不评审，但触及高风险路径时仍要评审。无需评审的改动直接进入第 5 步。
5. **原子提交与结单（Close）**：用 `git commit --only -- <本次改动路径>` 提交（避免卷入工作区其它未完成改动）；同步更新对应活文档；在 `docs/issues/INDEX.md` 将该卡更新为 `verifying-dev` 或 `done`（写明 `commit SHA` 与测试路径），已 `done` 的单张 `I-<id>-*.md` 立即删除，保持队列里只留活跃项。

### 统一评审规则

原则：同一段代码只审一次。评审按「一件完整的事」做，不按提交、不按开发包、不按行数、不按时间。原因：功能拆成小包逐包审、阶段终审再审一遍，会让同一段代码被审两次，每次小包评审还要重读上下文；对 2026 年 10 到 11 月评审日志的统计显示，多轮复审占了 87% 的评审耗时，且近半数复审抓到的是上一轮修复引入的新问题。

1. **机器检查先行**。lint、类型检查、测试全过才评审。评审模型不重跑全量测试，只为阻塞问题写最小复现，避免副审重跑慢速测试拖长整轮等待。
2. **评审单位是一个完整的功能或一次重构**。范围是从这件事开工前的基线到完成时的全量 diff。功能做完、机器检查全过之后，合入主干或推 `main` 之前，审一次。中途的提交和开发包不单独评审。
3. **不评审的改动**：带复现测试的 bug 修复（先看到测试失败，修完测试通过）；只改文档或测试的改动。例外：触及高风险路径（线协议、凭证、权限白名单或沙箱边界、持久化）的改动，再小也审。
4. **发版或晋升 PROD 之前不重审已审过的功能**。只核对主干上每个功能都有评审记录，没有记录的部分补审。
5. **怎么审**。两个不同模型并行盲审同一份冻结的全量 diff。默认 `gemini-4-carbon-high` 加 `gemini-4-argon-high`，经 `agy` 运行。全量 diff 超过 2000 行时，脚本按子系统把它切成几份同时审，算同一次评审；不要求作者把功能拆小了送审。单个评审进程限时 30 分钟，超时就用另一份结果，不重跑。
6. **阻塞只认五类**：违反核心原则、丢数据、漏凭证、扩大权限边界、可复现的崩溃或测试失败。阻塞问题附最小复现；其它意见记入本仓库的 Issue 账本，本轮不修，避免顺手改非阻塞项引发新一轮返工。
7. **修复后的确认**。只确认两件事：阻塞项是否修好，修复有没有弄坏相邻代码。范围是修复的 diff 和它碰到的文件；其余代码已经审过，不重审。由提出阻塞的那个模型做。确认后仍有阻塞，就停下交给用户裁决。
8. **仓库接入**。仓库根目录放 `.review.json` 写明本仓预检命令、高风险路径、切分规则、评审目录、非阻塞意见去处、打码文件和模型覆盖（示例见 [review.config.example.json](scripts/review.config.example.json)），不另立别的评审流程。把薄入口 [review-entry.sh](scripts/review-entry.sh) 拷到本仓 `scripts/review.sh` 转调全局 [review.sh](scripts/review.sh)，按需启用 `scripts/hooks/` 下的门禁钩子：

```bash
S=~/.agents/skills/vibe-coding/scripts
cp "$S/review.config.example.json" .review.json && mkdir -p scripts && cp "$S/review-entry.sh" scripts/review.sh && chmod +x scripts/review.sh
mkdir -p .githooks && cp "$S/hooks/pre-commit" "$S/hooks/pre-merge-commit" .githooks/ && chmod +x .githooks/pre-* && git config core.hooksPath .githooks
```

## 4. 自动文档与 Issue 巡检（`doc-lint`）

整理完文档或结单前，在仓库根目录运行检查脚本（支持 `--json` 供 Agent 自动修复）：

```bash
node <skill dir>/scripts/doc-lint.mjs [repo-root] [--json]
```
