---
name: vibe-coding
description: Wayne 的通用编码与项目工程规范：代码品味（按概念拆文件、无 boolean 开关参数、信任边界校验、默认删旧路径）、聚焦快检与本机隔离测试、目录与活文档边界（code / test / dev / probe / bench、DESIGN.md）、统一评审规则（完整功能审一次），以及 Issue 自动修复闭环。在写代码、改功能、修 bug、重构、新建或整理仓库、写/审文档或执行代码评审时使用。
---

# vibe-coding

承载所有仓库通用的代码品味、验证纪律、目录与文档边界，以及评审与 Issue 闭环。通用规则全放这里，不再往每个项目的 `AGENTS.md` 重复粘贴套话。

**优先级**：除「统一评审规则」外，仓库自己的 `AGENTS.md` 优先于本 Skill。仓库文档只写本仓特有的边界、快检命令、评审参数和踩坑教训，不另立评审流程。

## 1. 代码品味与日常开发纪律

- **先读全再动，模块归属清晰**：大改、重构或审计前完整通读目标文件，不靠搜索片段盲改。对你触及的模块负完整责任——复用已有抽象、合并你引入的重复逻辑、清掉你改出来的孤儿 import / 变量 / 函数；未坏的邻近代码不顺手重构。
- **按概念拆文件，不按行数拆**：一个文件只承载一个清晰概念并以它命名（单概念长文件没问题，混入第二个概念才拆；不建单 helper 碎文件或 `utils` 杂物间）。只有一处调用的一行 helper 直接内联。
- **显式状态，不写 boolean 行为开关**：不用 boolean flag 参数切换函数行为，拆成两个职责明确的函数或传 tagged union。读取或解析失败时返回 `null` / `undefined` 表示「未知」，不返回 `[]` / `""` 冒充正常空数据。
- **只在信任边界做校验，默认删旧路径**：网络输入、CLI 参数、外部配置与磁盘读取在入口做一次校验；内部模块之间信任已有类型与契约，不叠防御性 `typeof` / 形状检查。没有明确的外部兼容契约时，修复或重构直接删掉旧代码路径，不留 alias / shim / fallback。
- **两级验证门禁（毫秒级静态快检 → 集成后全量 + `ub-mode`）**：
  1. **编辑中途快检**：每次改完先对改动文件跑零配置静态检查——JS/MJS/TS 跑 `oxlint <改动文件>`（有 TS 配置再跑 `tsc --noEmit`），Python 跑 `ruff check <改动文件>`，Shell 脚本跑 `shellcheck <改动文件>`——再跑涉及的**单个测试文件**，几十毫秒拦住孤儿变量、异步漏 `await`、死分支与脚本引用错误，不在中途反复重跑慢速全量测试。新机器或容器缺工具时直接按此装齐：
     ```bash
     npm install -g oxlint       # JS / MJS / TS 静态与坏味道检查
     uv tool install ruff        # Python 静态检查与格式化（无 uv 用 pip install ruff）
     brew install shellcheck     # Shell 静态检查（Linux 容器用 apt-get install -y shellcheck）
     ```
  2. **集成完成门禁**：功能或修复收口时跑一次全量 `npm test`，并对改动文件跑 `ub-mode`（汇报 CRAP、重复对与变异测试数字）。修 bug 必须先写出在旧代码上失败、新代码上通过的复现测试。所有测试在当前会话终端里用临时实例、随机端口和临时 `HOME` 隔离运行，绝不停止或污染本机在跑的服务、也不弹窗抢焦点。
- **真实验证、陌生人通读与原子提交**：涉及外部服务调用的功能，离线单测通过后直接跑 3–5 次真实调用冒烟验证；带构建/安装产物的项目改源码后走构建同步命令，绝不手改安装态副本；尚未在目标环境验证时如实写明。交付前把改动文件从头到尾当陌生人通读一遍（无需跳读即可看懂），再用 `git commit --only -- <本次改动路径>` 原子提交（不跑 `git add .` / `git stash` 以免踩坏并行会话），改动外部行为或协议时同步更新 `DESIGN.md` / `docs/`。

## 2. 目录边界（按「谁来启动、会碰到什么」划分）

| 目录 | 放什么 | 边界与原因（The Boundary Test） |
|---|---|---|
| `<runtime>/` | 按进程/运行环境拆分的业务代码（如 `app/ host/ relay/ shared/`） | 纯逻辑与 I/O 外壳分离 |
| `test/` | `npm test` 直接跑的单测与契约测试 | **无需人工预启动服务即可通过**；只用临时实例与临时 `HOME`，不读写用户正在运行的服务、配置或剪贴板 |
| `dev/` | 需预启动外部依赖（本地中继、真机守护进程、无头浏览器）的 smoke / bench 脚本与假端 `fake-*.mjs` | 文件第 1 行写明前置条件（需启动哪些服务或环境变量），避免误当免准备单测跑挂 |
| `probe/` | 验证外部系统/二进制未知行为的一次性探针脚本 | 结论带**依赖版本号与日期**并入活文档；变成长期回归检查后移入 `dev/` |
| `bench/` | 跑分结果数据（如 `results.jsonl`） | 只放结果数据，跑分脚本放 `dev/` |
| `.scratch/` | 排查数据、临时截图、一次性审计输出 | 加入 `.gitignore`，严禁放进 `docs/` |

## 3. 文档分工（每个模块只维护一篇当前活文档）

| 文件 / 目录 | 读者与用途 | 规则 |
|---|---|---|
| `README.md` | 给人看：一句话定位、架构图、安装/启动/测试命令 | 不重复抄 `DESIGN.md` 内部细节 |
| `AGENTS.md` (`CLAUDE.md` 内容为 `@AGENTS.md`) | 给开发本仓库的 Agent 看（建议 50 行内） | 只写本仓特有的目录边界、**快速单测过滤命令**、活文档路由和本仓硬规则/教训（模板见 [agents-template.md](references/agents-template.md)），不重复抄通用编码规范 |
| `DESIGN.md`（小仓）或 `docs/subsystems/<module>.md`（大仓） | **唯一当前架构事实**（每个子系统一篇自包含文档） | 顶部带 Nimbus Frontmatter（`title` + `description`）。含当前结构、协议（含新旧端混用行为）、决定与理由、本模块的坑、试过不做的方案。代码注释用 `// DESIGN.md「章节」` 或 `// docs/subsystems/x.md#章节` 反指。模板见 [doc-and-api-template.md](references/doc-and-api-template.md) |
| `docs/decisions.md`（可选） | 已拍板的跨模块硬约束（`D1..Dn`） | 只放拍板结论、原因与被否掉的选项，不放待办 |
| `docs/api/` + `site/`（有对外接口时） | `openapi.yaml`（OpenAPI 3.x）+ 可选 [Cloudflare Nimbus](https://github.com/cloudflare/nimbus) 文档站 | `servers` 列出 PROD 与 DEV 完整 URL；配零费用接口回归测试。见 [doc-and-api-template.md](references/doc-and-api-template.md) |
| `docs/issues/` | **Agent 自动 Issue 队列**：`INDEX.md` + `I-<id>-<slug>.md` | 1 张卡片 = 1 个可独立 commit 的原子闭环；见 [issue-tracker-template.md](references/issue-tracker-template.md) |
| `SKILL.md`（仅当仓库对外交付 CLI/工具时） | 给**使用该工具**的外部 Agent 看 | 只写怎么用工具；怎么开发本仓库写进 `AGENTS.md` |

- **跨仓库底座经验**（如 `nsh`、`Herdr.app`）沉入对应底座的全局 Skill，不在业务仓重复抄。
- **删旧计划/排查报告前先分流**：已证实机制 → 并入 `DESIGN.md` 或 `docs/subsystems/*.md`；未做事项 → 拆成原子卡进 `docs/issues/`；原始数据 → `.scratch/` 或 `docs/archive/`（日常开发不读 `docs/archive/`）。

## 4. Agent 自动开发 · 测试 · Issue 修复 5 步闭环

当被要求「处理 Issue / 推进开发」时，按以下状态机自主闭环：

1. **选单（Pick）**：读 `docs/issues/INDEX.md`，只认领 `status: ready` 的第一条 `I-<id>`。遇到 `needs-decision`、`external-blocked`、`ops-approval` 时汇总选项向用户确认，不硬改。
2. **定位与复现（Red）**：读该卡指定的活文档与源码；先写回归测试跑 `verify`，确认在旧代码上 **FAIL**。
3. **实现与自检（Green）**：改代码确认回归测试 **PASS**，集成后跑一次全量 `npm test` 与改动文件的 `ub-mode`。
4. **按需独立审查（Gate）**：机器检查全过后，按下方「统一评审规则」执行：完整功能或重构在完成时对全量 diff 审一次；已先红后绿的普通 bug 修复免审（触及高风险路径除外）。
5. **原子提交与结单（Close）**：`git commit --only -- <本次改动路径>` 提交，同步更新活文档；在 `docs/issues/INDEX.md` 更新为 `verifying-dev` 或 `done`（附上 commit SHA 与测试名），并立即删除已 `done` 的单张 `I-<id>-*.md`。

### 统一评审规则

原则：同一段代码只审一次，按「一件完整的事」做，不按提交、开发包、行数或时间设门槛。流程变慢时只删逻辑上重复的步骤（如重跑全量测试、写双份草稿、拷双份仓库），不加数值门槛。

1. **机器检查先行**：lint、类型检查、测试全过才送审。评审进程不重跑全量测试，只为阻塞问题跑最小复现。
2. **评审单位与免审范围**：完整功能或重构从基线到完成时的全量 diff 审一次；发版前只核对评审记录，不重审已审功能。带复现测试（先红后绿）的 bug 修复与纯文档/测试改动免审，但触及高风险路径（线协议、凭证、权限白名单/沙箱边界、持久化）再小也审。
3. **干净上下文 + 异构模型盲审**：审查者必须用全新独立上下文，且必须是**不同于作者的模型家族**（起子 Agent 前先核对 `env | grep ANTHROPIC_DEFAULT` 等别名映射，避免 `opus`/`sonnet` 别名实际仍指向同一模型）。默认经 [review.sh](scripts/review.sh) 用 `gemini-4-carbon-high` + `gemini-4-argon-high` 并行盲审冻结的 `diff.patch`（超过 2000 行按子系统自动切片并行审）；轻量子代理审查可用 `hc run --bg` 起另一家模型并把报告写文件。
4. **阻塞只认五类**：违反核心原则、丢数据、漏凭证、扩大权限边界、可复现的崩溃或测试失败（附最小复现）。其余记入 `docs/issues/INDEX.md` 本轮不修；修复后只由提出阻塞的那个模型对修复 diff 与触及文件确认一次，仍有阻塞交用户裁决。
5. **仓库接入**：根目录放 `.review.json`（示例见 [review.config.example.json](scripts/review.config.example.json)），薄入口 [review-entry.sh](scripts/review-entry.sh) 拷入 `scripts/review.sh`，按需装 `.githooks/`：

```bash
S=~/.agents/skills/vibe-coding/scripts
cp "$S/review.config.example.json" .review.json && mkdir -p scripts && cp "$S/review-entry.sh" scripts/review.sh && chmod +x scripts/review.sh
mkdir -p .githooks && cp "$S/hooks/pre-commit" "$S/hooks/pre-merge-commit" .githooks/ && chmod +x .githooks/pre-* && git config core.hooksPath .githooks
```

## 5. 自动文档与 Issue 巡检（`doc-lint`）

整理完文档或结单前运行巡检（支持 `--json`）：

```bash
node ~/.agents/skills/vibe-coding/scripts/doc-lint.mjs [repo-root] [--json]
```
