# Herdr.app 分屏开发与批判性实测工作流（`herdr-app` + `hc`）

在 **Herdr.app**（`__CFBundleIdentifier=dev.herdr.app`）中，用同 Tab 分屏把**思考控场、编码实现、对抗审查、真实终端测试**放在同一个视野内。

核心原则（结合 Addy Osmani《Critical thinking when agents do the work》）：
- **人只有一双眼睛（One Pair of Eyes）**：绝不把子任务丢进隐藏的新 Tab（`tab.new`）。固定在**当前 Tab 内分屏**（`pane.split`），省去来回切 Tab 的调度税（Orchestration Tax）。
- **外包执行，不移交判断（Cognitive Offloading, Not Surrender）**：派单前先立假设与证伪条件，用独立 `Reviewer` 找盲区、用纯 `Terminal` 跑真实命令抓报错，最后由 `Orchestrator` 替用户把输出收敛到真正需要人拍板的隐式决策上。

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
   - 等命令跑完用 `hc wait --output`，不用轮询文件。先在后台开始等，再发命令（2026-11-05 实测）：
     ```bash
     ( hc wait "$TERM_ID" --output "__done_1:" --timeout 600 ) &
     env -u HC_TERMINAL_ID hc send "$TERM_ID" "cd /tmp && bash test.sh ; echo '__do''ne_1':\$?"
     wait
     hc read --lines 60 "$TERM_ID"   # 最后一行 __done_1:<退出码>
     ```
     - 标记写成 `'__do''ne_1'`：屏幕上回显的命令行里没有 `__done_1`，`hc wait` 只会匹配到 echo 的输出。
     - 标记前用分号 `;`，不用 `&&`：前面的命令失败了也会打出标记，主窗口不会死等。
   - 一次性命令、不需要固定的右下 `Terminal` 时，可以用 `hc run` 在当前 Tab 新开一个分屏，`hc wait` 直接返回退出码：
     ```bash
     hc run --bg --name test-1 --cwd "$PWD" --label herdr.space="$MY_SPACE" --label herdr.tab="$MY_TAB" -- bash test.sh
     hc wait test-1    # 返回 exit_code；跑完 hc rm test-1
     ```
2. **操作 `Worker` / `Reviewer` 子 Agent 时严禁让它回调 `hc send <主窗口>`**：
   - `hc send <target>` 会直接往目标终端输入框粘贴文本并按回车（`\r`）；若用户正在左屏 `Orchestrator` 打字，子窗口调 `hc send $MY_TERMINAL` 会把用户写到一半的句子当场截断发出去。`hc send` 会等人停止打字再粘贴，但人打到一半停下来想，也算停顿，所以这个保护不够。
   - **固定做法**：子 Agent 把结果写进 `/tmp/herdr-<task>/*.md` 后自然结束回合；`Orchestrator` 用 `hc wait` 循环等待子 Agent 状态变为 `done` 后直接读文件。

---

## 3. 批判性思维四角色协同流程（省注意力 + 真实验证）

### 第一步：`Orchestrator` 派单前（先立假设，传一手材料）
1. **先立假设与证伪条件（Formulate a Hypothesis & Falsifier）**：明确预期结果，以及*“什么反例或报错出现就说明我们错了？”*
2. **预先定义“什么算验证通过”（Define Verified Upfront）**：以 `Terminal` 跑出的真实退出码、DB 记录、文件 sha256 或边界集统计为准，绝不把“代码/文档看起来写完了”当完成。
3. **传一手路径与原始标识（No Summary Telephone）**：给 `Worker` 和 `Reviewer` 传精确文件路径、行号、commit 或原始会话 ID，不传二道浓缩摘要。

### 第二步：`Worker` 实现 + `Terminal` 实测 + `Reviewer` 独立证伪
1. **`Worker`（右上）**：完成代码或独立脚本编写，记录改动点与隐含假设。
2. **`Terminal`（右下）**：在真实环境或隔离目录（如 `/tmp`）直接跑脚本/测试，检验是否真的能跑通（例如实测独立文档脚本能否在无仓库依赖下跑出 `EXIT:0`）。
3. **`Reviewer`（右中）**：在独立上下文中启动（如 `epi --approve --model deepseek/deepseek-flash --thinking high` 或 `factory/gpt-6.1-sol`），执行：
   - **穿透单一绿灯（What Green Proved vs. Missed）**：单条样本跑通后，追问全量分布或边界条件下会不会失效；
   - **盲区与隐式决策自检（Did I miss anything?）**：挑出实现里替用户暗自做掉的决定（默认值、被吞掉的报错、兼容性取舍），写入 `/tmp/herdr-<task>/review.md`。

```bash
# Orchestrator 等待 Worker 或 Reviewer 回合结束
while true; do
  WAIT_OUT=$(hc wait "$REVIEWER_TERM" 2>&1)
  echo "$WAIT_OUT"
  if ! printf '%s' "$WAIT_OUT" | grep -q "still running:"; then
    break
  fi
done
```

### 第三步：`Orchestrator` 回收与汇报（证据先行，守护用户注意力）
`Orchestrator` **先核对 `Terminal` 的真实输出与 `Reviewer` 的原始证据**，再向用户做高密度汇报：
1. **结论与实测证据（Evidence First）**：`Terminal` 跑了什么命令、退出码与关键数字/产物路径是什么。
2. **假设 vs 实测（Hypothesis vs. Reality）**：实测抓到了什么报错（如 SQL 类型转换问题）、反例或线上差异，是否已闭环修复。
3. **绿灯边界（What Was Proven vs. Unchecked）**：本次测试实际覆盖了什么，**还有哪 1–2 个边界没测到**。
4. **隐含决策与需拍板项（Accountability Focus）**：把代码/方案暗自替你决定的地方单独拎出来，让你只把注意力花在真正需要你签字负责的判断上。
