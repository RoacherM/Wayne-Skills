---
name: herd
description: >
  多 Agent 并行编排与跨机/跨 CLI 协同（统筹、派活、多模型擂台、长时任务）：
  开工前批量探测本机或远端全部编码 CLI（agy / claude / codex / pi / epi / droid / grok）的模型可用性，
  通过共享 JSONL 公告板（board.jsonl + fcntl.flock）和任务书（BRIEF.md + roster.json）分工，
  由 herd-watch 在 Herdr.app（hc，默认）或终端版 herdr 上做 @mention 唤醒、blocked 延迟补发、
  截止时间/冷场/额度耗尽巡检，仅认 [done] 帖加机检命令通过验收。
  日常单 Worker 左 1+右 2 可见分屏继续用 herdr skill；2+ Worker 并行、跨机（如 cpu2）、异构模型擂台或无人值守长任务时用本 skill。
---

# herd：多 Agent 并行编排与公告板协同

你是协调者（Coordinator）：负责探针、定合约、派活、机检验收和收尾；具体实现交给 Worker。

改编自 [`ythx-101/herd-skill`](https://github.com/ythx-101/herd-skill)（MIT），已适配 **Herdr.app（`herdr-app` + `hc`）为主、旧终端版 `herdr` 兼容**，支持本机全部 7 个编码 CLI（`agy` / `claude` / `codex` / `pi` / `epi` / `droid` / `grok`），使用 Python `fcntl.flock`（无需 macOS 缺失的 util-linux `flock` 与 GNU `timeout`），并默认守住左屏交互窗口防打断红线。

## 与 `herdr` / `vibe-coding` 的边界

- **日常单 Worker 盯盘开发**（左 1 Orchestrator + 右上 Worker + 右下 Terminal）：继续用 `herdr` skill，不必上公告板与守护进程。
- **2+ Worker 并行协作、跨机（如 `hc` 已连的 `cpu2`）、多模型擂台（arena）或长时无人值守任务**：用本 skill。
- **独立代码审查**：不要手工把产物改名 A/B/C 做粗糙盲审，直接复用 `vibe-coding` skill 的 `review.sh`（统一评审规则）和 `ub-mode` 量具作为机检命令。
- **跨仓纠偏**：并行 Worker 严禁直接修改 `MEMORY.md`，统一投递到 `~/.agents/corrections/inbox/`。

## 工具清单（`<skill>/bin/`）

| 脚本 | 作用 |
|---|---|
| `bin/herd-preflight <machine> [--all \| <cli[:model]>...]` | 开工前并发试探 CLI/模型：`ok` / `quota` / `no-capacity` / `timeout` / `missing` / `error` |
| `bin/herd-post <project> <author> <text...\|->` | `fcntl.flock` 加锁追加帖子到 `<project>/board.jsonl`，打印新序号 `#seq`；`-` 从 stdin 原样读正文 |
| `bin/herd-read <project> [--since N] [--json]` | 读取 `seq > N` 的帖子 |
| `bin/herd-watch start\|stop\|status <project>` | 启动/停止/查看后台守护 `herd-watchd.py`（日志 `<project>/watch.log`，告警 `<project>/alerts.jsonl`，游标 `<project>/watch.state.json`） |
| `templates/BRIEF.zh-CN.md` / `BRIEF.md` / `roster.json` | 每个项目复制填写的合约与花名册模板 |

跨机公告板模式：将 `bin/herd-post` 与 `bin/herd-read` 两个无依赖单文件脚本拷到公告板宿主机 `~/herd/bin/`，在协调者机设置 `HERD_BOARD_HOST=<ssh-host>`、`HERD_ROOT='~/herd'`、`HERD_REMOTE_BIN='~/herd/bin'`。

## 关键环境变量

| 变量 | 含义 | 默认值 |
|---|---|---|
| `HERD_BACKEND` | 底层后端：`auto` / `hc` / `herdr` | `auto`（优先 `hc`，仅 `HERDR_ENV=1` 且无 `HC_TERMINAL_ID` 时走旧 `herdr`） |
| `HERD_COORD_MODE` | 覆盖花名册里的 `coordinator.mode`：`notify` 或 `unattended` | 读 `roster.json`（默认 `notify`） |
| `HERD_NOTIFY_CMD` | `notify` 模式触发告警时在本机执行的非侵入钩子（环境变量带 `HERD_ALERT_KEY` / `KIND` / `TEXT`） | 空 |
| `HERD_BOARD_HOST` | 公告板所在 SSH 主机；空或 `local` 为本机 | 本机 |
| `HERD_ROOT` | 公告板主机上短项目名根目录 | `~/herd` |
| `HERD_INTERVAL` | 守护轮询间隔（秒） | `20` |
| `HERD_DENY_PANES` | 绝不发送 prompt 的终端/窗格名（逗号分隔） | 空 |
| `HERD_LANG` | 守护提醒语言：`en` 或 `zh` | `en` |
| `HERD_PING_CMD` | 自定义 preflight 模板（支持 `{model}` 与 `{prompt}`） | 按内置 7 个 CLI 路由 |

## 7 步流程

### 1. Preflight（2 分钟内测清可用模型）

```bash
<skill>/bin/herd-preflight local --all                                     # 测本机所有已装 CLI 默认模型
<skill>/bin/herd-preflight local claude:sonnet codex agy:gemini-4-carbon-high epi:deepseek/deepseek-flash
<skill>/bin/herd-preflight cpu2 --all                                      # 测远端机器
```

只给返回 `ok` 的 CLI/模型派活，并为每个席位选好备用模型。`no-capacity`（`503`）不是额度耗尽，稍后重试即可；`quota` 才换模型。

### 2. 写任务书（`BRIEF.md`）与花名册（`roster.json`）

- 复制 `templates/BRIEF.zh-CN.md`（限 60 行）：写绝对截止时间（含时区与 UTC）、文件所有权边界（同仓并发改动优先每人独立 `git worktree`，禁止 `git add .`，一律 `git commit --only -- <路径>`）、每项交付的**机检命令**、备用模型与公告板读写命令。
- 复制 `templates/roster.json`：
  - **`coordinator.mode` 默认保留 `"notify"`**：守护进程**绝不**往你正在交互的左屏主窗口发 `hc send`，而是把 `@coordinator` 提醒与超时/停滞/额度告警写入 `<project>/alerts.jsonl`（并可配 `HERD_NOTIFY_CMD` 弹系统通知），主窗口在 `hc wait --children any` 间隙主动读板。**仅当协调者跑在独立无人值守窗格时才设为 `"unattended"`。**
  - `members` 中每个成员键名 = 公告板发帖名 = `@名字` = `hc` 终端名（或 `herdr` agent 名）；远端机器写 `machine: "<label>"`（在 `hc` 后端自动拼成 `<label>/<agent>`，如 `cpu2/builder`）。

### 3. 启动 Worker

- **Herdr.app（`hc` 优先）**：
  - 后台运行用 `hc run --bg --name <name> --cwd "$PWD" <cli> "<首条任务>"`（同 Tab 可见分屏则先按 `herdr` skill 规则用 `herdr-app do pane.split` 切分屏再起进程，或传 `--label herdr.space="$MY_SPACE" --label herdr.tab="$MY_TAB"`）。
  - 检查 `hc get --json <name>` 的 `first_message.sent` 或 `hc read --lines 30 <name>`，若卡在 trust prompt 先 `hc keys <name> enter` 处理完再派活。
- **旧终端版 `herdr`**（仅当 `HERDR_ENV=1` 且无 `HC_TERMINAL_ID`）：`herdr [--machine <label>] pane split` + `herdr agent start`。
- 给 Worker 的第一条消息尽量短：“你是 `<name>`，读 `<project>/BRIEF.md` 并严格照做。”随后在板上派活：`herd-post <project> coordinator '@<name> 开工，见 BRIEF'`。
- **派活帖避坑**：只给**此刻就要唤醒的成员**加 `@`；正文里提到“完成后通知 beta”时不要写成 `@beta`，否则 `herd-watchd` 会把 `beta` 也一并立刻唤醒导致抢跑。

### 4. 启动守护（`herd-watch`）

```bash
HERD_LANG=zh <skill>/bin/herd-watch start <project>   # status / stop 同参数
```

每 20 秒轮询一次：
- **横向唤醒**：词首 `@name`（`@all` 全员，`@fix` 命中 `fix-1`/`fix-2`）触发 `hc send` / `herdr agent prompt` 发一行 80 字摘要逼对方 `herd-read`。若目标处于 `blocked`，游标停在最早未送达帖前，解除阻塞后自动补发且不重复骚扰他人；目标 `missing` 或 `exited` 则记 `FAIL` 不卡游标。
- **三类告警**：到 `deadline_utc` 告警一次；有成员未交付且冷场超过 `stall_minutes` 按 `stall:<last_seq>` 告警（若之前交过 `[done]` 但后来被 `@name failed:` / `[rework]` / `打回` 打回重做，会自动重新纳入未完成集合）；逐成员读窗格查精确额度耗尽短语（自动跳过含 `[board]`/`[herd-watch]` 的回显行）。
- 单次演练不调用 `hc`/`herdr`：`python3 <skill>/bin/herd-watchd.py --once --dry-run <project>`。

### 5. 机检验收

- `hc` 的 `done` / `idle` 只代表对方停手，**不算完成**。
- 只有成员在公告板发了 `@coordinator [done] <摘要 + REPORT 路径>`，**并且**协调者亲手跑通 `BRIEF.md` 里所有机检命令（如 `npm test`、`oxlint`/`ruff`/`shellcheck`、`ub check --changed`），才算验收通过。
- 任一检查失败，在板上发 `@<name> failed: <失败原因与命令输出>` 打回（守护进程会自动取消其 `[done]` 标记并恢复冷场监控）。
- 到 `deadline_utc` 按现有产物收卷，不无休止延期。

### 6. 盲审（可选）

代码改动达到评审边界时，按 `vibe-coding` skill「统一评审规则」直接运行 `scripts/review.sh precheck/start/wait/verify` 做异构模型盲审，不另造一套评审协议。

### 7. 收尾

- 在板上发一条不带 `@` 的总结帖 `[done] <总结>`，执行 `<skill>/bin/herd-watch stop <project>`。
- 只关闭自己创建的 Worker（`hc rm <name>` 或 `herdr pane close`），不碰用户自己的窗格。
- 在项目目录留一份简短复盘（结论、耗时、踩坑）。
