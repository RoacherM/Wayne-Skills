---
name: herdr
description: >
  在 Herdr.app 中使用同 Tab 分屏（herdr-app + hc）执行「开发模式（左 1 + 右 3：Orchestrator / Worker / Reviewer / Terminal）」与「测试模式」的工作流；验证与审查规则沿用 pstack。
  当用户提到 Herdr、herdr-app、hc、分屏、开个分屏、子窗口测试、分屏 review、右边窗口跑一下，或在 Herdr.app 中需要协同多窗口/终端开发与实测时使用。
---

# Herdr.app 分屏开发与批判性实测工作流（`herdr-app` + `hc`）

在 **Herdr.app**（`__CFBundleIdentifier=dev.herdr.app`）中，用同 Tab 分屏把**思考控场、编码实现、对抗审查、真实终端测试**放在同一个视野内。命令全集可通过 `herdr-app --skill` 与 `hc --skill` 查看；本文件固定分屏铁律、四角色布局与批判性验证流程。

两条底线：
- **同一个视野**：子任务固定在当前 Tab 内分屏（`pane.split`），不开隐藏的新 Tab（`tab.new`）。
- **外包执行，不移交判断**：验证和审查按 pstack 的规则做，见第 3 节。

---

## 1. 布局与模式最佳实践（开发模式 vs 测试模式）

### 1.1 开发模式：左 1 + 右 3 四角色布局（`Orchestrator` / `Worker` / `Reviewer` / `Terminal`）

开发新功能、重构或复杂问题攻坚时，推荐在当前 Tab 构建 **左 1 + 右 3（右侧上下三栈）** 的四角色同屏布局：

```text
+-----------------------------------+-----------------------------------+
|                                   |  右上：Worker (编码实现 Agent)     |
|                                   |  写代码、改实现、输出改动与假设说明 |
|                                   +-----------------------------------+
|  左屏（主窗口）：Orchestrator      |  右中：Reviewer (批判性审查 Agent) |
|  与用户对齐意图、先立假设、拆解任务 |  独立上下文，查盲区/反例/隐式决策   |
|  调度右侧三屏、提炼需人拍板的决策   +-----------------------------------+
|                                   |  右下：Terminal (纯 zsh 实测终端)  |
|                                   |  不起 Agent，直接跑测试/脚本/构建   |
+-----------------------------------+-----------------------------------+
```

| 角色 | 位置 | 运行形态 | 核心职责 |
|---|---|---|---|
| **Orchestrator** | 左屏（`$MY_TERMINAL`） | 主对话 Agent | 与用户聊方案、澄清模糊意图（防 Intent Debt）、派单前先立假设与验收标准、调度右侧三屏、汇总证据并守住用户注意力。 |
| **Worker** | 右上（`$WORKER_TERM`） | 交互式编码 Agent（`epi` / `claude` / `codex`） | 接收明确边界与一手文件路径，专注完成代码实现或文档编写，把改动与假定写入 `/tmp/herdr-<task>/worker.md`。 |
| **Reviewer** | 右中（`$REVIEWER_TERM`） | 交互式独立审查 Agent（建议异构模型，如 `gpt-6.1-sol` / `deepseek-flash`） | **全新独立上下文**（不参与写代码，无沉没成本）：对照原需求与 `git diff` 做证伪式 Review，专找边界漏判、静默吞错与隐式决定，写入 `/tmp/herdr-<task>/review.md`。 |
| **Terminal** | 右下（`$TERM_ID`） | **纯 `zsh` 终端（不起 Agent）** | 直接执行确定性 shell 命令：跑单测/集成测试、在 `/tmp` 空目录实测独立脚本、跑 `ub-mode` 量具或线上只读核查，零 LLM 转发开销，直接暴露真实报错。 |

#### 一键构建「左 1 + 右 3」布局命令
先通过铁律 2 反查出左屏自身的 `$MY_PANE`，再依次向右、向下、向下切出右侧三屏：

```bash
# 1. 从左屏向右切出 Worker（右上）
S1=$(herdr-app do pane.split --direction right --pane "$MY_PANE")
WORKER_PANE=$(printf '%s' "$S1" | node -pe 'JSON.parse(fs.readFileSync(0,"utf8")).pane')
WORKER_TERM=$(printf '%s' "$S1" | node -pe 'JSON.parse(fs.readFileSync(0,"utf8")).terminal')

# 2. 从 Worker 向下切出 Reviewer（右中）
S2=$(herdr-app do pane.split --direction down --pane "$WORKER_PANE")
REVIEWER_PANE=$(printf '%s' "$S2" | node -pe 'JSON.parse(fs.readFileSync(0,"utf8")).pane')
REVIEWER_TERM=$(printf '%s' "$S2" | node -pe 'JSON.parse(fs.readFileSync(0,"utf8")).terminal')

# 3. 从 Reviewer 向下切出纯实测 Terminal（右下）
S3=$(herdr-app do pane.split --direction down --pane "$REVIEWER_PANE")
TERM_PANE=$(printf '%s' "$S3" | node -pe 'JSON.parse(fs.readFileSync(0,"utf8")).pane')
TERM_ID=$(printf '%s' "$S3" | node -pe 'JSON.parse(fs.readFileSync(0,"utf8")).terminal')
```

### 1.2 测试模式：左 1 + 右 1（或右 2）轻量布局

当任务不涉及复杂编码，仅需验证脚本、重放线上数据或做独立探查时，按需选择：
1. **纯脚本 / 命令实测模式（左 `Orchestrator` + 右 `Terminal`）**：
   - 右屏只开一个纯 `zsh` 分屏（不起任何子 Agent），直接切到隔离目录（如 `cd /tmp`）实测脚本、安装命令或验证文档步骤能否零依赖跑通。
2. **探查 + 实测双屏模式（左 `Orchestrator` + 右上 `Reviewer/Tester Agent` + 右下 `Terminal`）**：
   - 右上用轻量快速模型（如 `epi --approve --model deepseek/deepseek-flash --thinking high`）做多步探查与全量样本统计；右下留纯 `zsh` 终端随时跑确定性验证脚本。

---

## 2. 三条硬性技术铁律（避开其他模型的常见错位）

### 铁律 1：只用 `herdr-app` + `hc`，禁用旧版 `herdr` CLI
- `herdr-app`（`~/.local/bin/herdr-app`）：管理 GUI 布局树（`spaces` → `tabs` → `panes` → `terminals`），负责分屏、聚焦与关闭分屏。
- `hc`（`~/.local/bin/hc`，即 `herdr-core`）：管理持久终端（`t...`）、发送输入（`hc send`）、等待 Agent 回合结束（`hc wait`）、读取屏幕（`hc read`）及 OSC 7501 状态（`idle` / `working` / `done` / `blocked` / `error`）。
- **禁止**：不要检查 `HERDR_ENV=1`，也不要运行旧版 `herdr status` / `herdr pane` / `herdr agent`（旧版 TUI 的 `~/.config/herdr/herdr.sock` 未运行）。在 Herdr.app 内一律检查 `test -n "${HC_TERMINAL_ID:-}"`。

### 铁律 2：用 `$HC_TERMINAL_ID` 反查当前分屏并同 Tab 分屏（`pane.split`），严禁 `tab.new`
其他模型常犯三个错：① 调 `herdr-app do tab.new` 新开 Tab 把子窗口藏到后台；② 把终端 ID `$HC_TERMINAL_ID`（如 `t2j`）当成 `--pane` 传给 `pane.split`；③ 直接取 `herdr-app status` 的 `focused_pane`（用户思考期间点到别的窗口就会分错屏）。

- **必须**用自身环境变量 `$HC_TERMINAL_ID` 在 `herdr-app ls` 中反查自己精确所属的 `MY_SPACE`、`MY_TAB`、`MY_PANE`（`p...`）及同 Tab 已有的兄弟终端：

```bash
eval "$(herdr-app ls | node -e '
  const d = JSON.parse(require("fs").readFileSync(0, "utf8"));
  const me = process.env.HC_TERMINAL_ID;
  for (const s of d.spaces || []) {
    for (const t of s.tabs || []) {
      for (const term of t.terminals || []) {
        if (term.terminal === me) {
          const siblings = (t.terminals || []).filter(x => x.terminal !== me);
          console.log(`MY_SPACE=${s.id}`);
          console.log(`MY_TAB=${t.id}`);
          console.log(`MY_PANE=${term.pane}`);
          console.log(`MY_TERMINAL=${term.terminal}`);
          console.log(`SIBLING_TERMS=${siblings.map(x => x.terminal).join(",")}`);
          console.log(`SIBLING_PANES=${siblings.map(x => x.pane).join(",")}`);
          process.exit(0);
        }
      }
    }
  }
  console.error("HC_TERMINAL_ID not found in herdr-app ls:", me);
  process.exit(1);
')"
```

- 若 `SIBLING_TERMS` 中已有同 Tab 分屏，优先按角色复用；否则对 `$MY_PANE` 分屏（除非用户明确要求新开 Tab，否则**严禁**调 `tab.new`）。

### 铁律 3：区分「发给子 Agent」与「直接发给纯 Terminal」，且严禁子窗口 `hc send <主窗口>`

1. **直接操作纯 `Terminal`（`zsh`）时必加 `env -u HC_TERMINAL_ID`**：
   - 当调用方环境变量里有 `HC_TERMINAL_ID` 且目标终端曾跑过 Agent（`status` 非空）时，普通 `hc send` 会自动把文本包成 `<hc from="t...">...</hc>`，导致 `zsh` 报 `parse error`。
   - 此外，命令末尾连接完成标记时**必须用分号 `;` 而不是 `&&`**（否则前序命令失败退出非 0 时不会写入 `.done` 文件，导致主窗口死等）：
     ```bash
     rm -f /tmp/herdr-cmd.done
     env -u HC_TERMINAL_ID hc send "$TERM_ID" "cd /tmp && bash test.sh ; echo EXIT:\$? > /tmp/herdr-cmd.done"
     while [ ! -f /tmp/herdr-cmd.done ]; do sleep 1; done
     cat /tmp/herdr-cmd.done
     hc read --lines 60 "$TERM_ID"
     ```
2. **操作 `Worker` / `Reviewer` 子 Agent 时严禁让它回调 `hc send <主窗口>`**：
   - `hc send <target>` 会直接往目标终端输入框粘贴文本并按回车（`\r`）；若用户正在左屏 `Orchestrator` 打字，子窗口调 `hc send $MY_TERMINAL` 会把用户写到一半的句子当场截断发出去。
   - **固定做法**：子 Agent 把结果写进 `/tmp/herdr-<task>/*.md` 后自然结束回合；`Orchestrator` 用 `hc wait` 循环等待子 Agent 状态变为 `done` 后直接读文件。

---

## 3. 四角色协同流程

判断规则不在这里重写，直接用 pstack。pstack 的 skill 只能手动调用，所以按路径读 `~/.agents/skills/<name>/SKILL.md`。本节只写这些规则在分屏里落在哪：

| 步骤 | 谁做 | 按哪个 pstack skill |
|---|---|---|
| 派单前：复述目标，写下假设、反例和「什么算通过」 | Orchestrator | `in-your-own-words`、`principle-prove-it-works` |
| 实现 | Worker | `poteto-mode` 里匹配的 playbook |
| 实测：在真实环境或 `/tmp` 空目录跑命令，看退出码和产物 | Terminal（纯 zsh） | `principle-prove-it-works`；代码量具用 `ub-mode` |
| 独立证伪：只留跑出来能证实的问题 | Reviewer（换一个模型） | `interrogate` 给审查者的 brief |
| 汇报：证据在前，列出等用户拍板的事 | Orchestrator | `ketchup` |

分屏特有的三条：
1. 给 Worker 和 Reviewer 传一手材料：精确路径、行号、commit，不传二手摘要。
2. 子 Agent 把结果写进 `/tmp/herdr-<task>/worker.md` 或 `review.md`，然后结束回合。**不要**让它 `hc send` 回主窗口（铁律 3）。
3. Orchestrator 用 `hc wait` 等子 Agent 结束，再读文件：

```bash
while true; do
  WAIT_OUT=$(hc wait "$REVIEWER_TERM" 2>&1)
  echo "$WAIT_OUT"
  if ! printf '%s' "$WAIT_OUT" | grep -q "still running:"; then
    break
  fi
done
```
