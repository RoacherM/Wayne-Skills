---
name: herdr
description: >
  在 Herdr.app 中使用同 Tab 左右分屏（herdr-app + hc）执行「主窗口聊方案与调度 + 子分屏独立实测、证伪与 Review」的开发工作流，结合批判性思维（先立假设、穿透单一绿灯、证据先行、保护注意力）。
  当用户提到 Herdr、herdr-app、hc、分屏、开个分屏、子窗口测试、分屏 review、右边窗口跑一下，或在 Herdr.app 中需要派发子 Agent（epi、claude、codex）做实测与审查时使用。
---

# Herdr.app 分屏实测与批判性审查工作流（`herdr-app` + `hc`）

在 **Herdr.app**（`__CFBundleIdentifier=dev.herdr.app`）中，用**左屏主窗口（思考、立假设、控场）+ 右屏子分屏（独立上下文实测、证伪、Review）**协同工作。命令全集可通过 `herdr-app --skill` 与 `hc --skill` 查看；本文件固定分屏铁律与批判性验证流程。

核心原则（结合 Addy Osmani《Critical thinking when agents do the work》）：
- **人只有一双眼睛（One Pair of Eyes）**：绝不把子 Agent 丢进隐藏的新 Tab（`tab.new`）。固定在**当前 Tab 向右分屏**（`pane.split`），让左屏对话与右屏实测同屏可见，省去切 Tab 的调度税（Orchestration Tax）。
- **外包执行，不移交判断（Cognitive Offloading, Not Surrender）**：派单前先立假设与证伪条件，要求右屏拿真实命令和反例说话，不被单一“绿灯”或漂亮总结糊弄，最后替用户把输出收敛到真正需要人拍板的隐式决策上。

---

## 1. 三条硬性技术铁律（避开其他模型的常见错位）

### 铁律 1：只用 `herdr-app` + `hc`，禁用旧版 `herdr` CLI
Herdr.app 的窗口布局与终端进程分属两个 CLI：
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

- 若 `SIBLING_TERMS` 中已有同 Tab 空闲/已完成的测试分屏，优先复用；否则对 `$MY_PANE` 向右分屏（除非用户明确要求新开 Tab，否则**严禁**调 `tab.new`）：

```bash
SPLIT_OUT=$(herdr-app do pane.split --direction right --pane "$MY_PANE")
CHILD_PANE=$(printf '%s' "$SPLIT_OUT" | node -pe 'JSON.parse(fs.readFileSync(0, "utf8")).pane')
CHILD_TERM=$(printf '%s' "$SPLIT_OUT" | node -pe 'JSON.parse(fs.readFileSync(0, "utf8")).terminal')
```

### 铁律 3：主窗口用 `hc wait` + 文件收结果，严禁让子窗口 `hc send <主窗口>` 抢输入框
`hc send <target> "<text>"` 的机制是直接往目标终端输入框粘贴 `<hc from="...">...</hc>` 并按回车（`\r`）。
- 如果用户正在左屏主窗口（`$MY_TERMINAL`）打字，此时右屏子窗口执行 `hc send $MY_TERMINAL "..."`，会把用户写到一半的句子当场截断并按回车发出去。
- **固定做法**：
  1. **严禁**在给子窗口的指令里要求它执行 `hc send $MY_TERMINAL`（除非用户明确要求脱机后台挂机、主窗口已完全退出等待）。
  2. 要求子窗口把详细证据与结论写进约定文件（如 `/tmp/herdr-<task>/report.md`），在它自己分屏打印简短摘要后自然结束 turn。
  3. 主窗口用 `hc wait "$CHILD_TERM"` 阻塞等待（`hc wait` 每 180 秒会返回一次 `still running:` 心跳，循环调到返回终态为止），再去读 `/tmp/herdr-<task>/report.md` 或 `hc read --lines 80 "$CHILD_TERM"`。

---

## 2. 批判性思维分屏工作流（省注意力 + 真实验证）

当生成代码和总结越来越快、越来越像样时，瓶颈不再是“写出来”，而是“怎么用最少注意力确认它真的对”。左右两屏按职责分工：

| 屏幕 | 角色 | 认知职责 |
|---|---|---|
| **左屏（主窗口）** | 方案伙伴与总控 | 替用户把模糊意图理清（防 Intent Debt）、派单前先立假设与证伪标准、传递一手上下文、回收后过滤套话并提炼需人拍板的隐式决策。 |
| **右屏（子分屏）** | 独立实测与证伪者 | 在**全新独立上下文**（无沉没成本）中交互式运行，执行真实测试/集群只读核查，尝试推翻左屏假设，穿透单一绿灯找盲区。 |

### 第一步：派单前（左屏主窗口 — 先立假设，传一手材料）

1. **先写假设与证伪条件（Formulate a Hypothesis & Falsifier）**：
   - 派单前先明确：*我们预期会发生什么？什么事实或反例出现就说明我们错了（What would have to be true for this to be wrong）？*
2. **预先定义“什么算验证通过”（Define Verified Upfront）**：
   - 把完成线定在可核查的硬证据上（真实命令退出码与原始输出、DB 记录、文件 sha256、真实会话重放、边界样本分布），绝不把“代码看起来写对了”当验证。
3. **传一手路径与原始标识，拒绝二道贩子摘要（No Summary Telephone）**：
   - 给右屏传精确的文件路径、行号、commit、真实会话 URL 或原始表名，不要只传主窗口浓缩改写过的二道摘要。

### 第二步：实测与审查（右屏子分屏 — 交互式运行，穿透单一绿灯）

右屏一律以**交互式 TUI** 启动（绝不加 `-p` / `--print` 跑完即退），方便用户随时眼看右屏进度或直接插话：

- **快速实测 / 线上只读核查 / 产物重放（`epi` + `deepseek-flash`）**：
  ```bash
  hc send "$CHILD_TERM" "cd $(pwd) && epi --approve --model deepseek/deepseek-flash --thinking high '<任务提示词>'"
  ```
- **对抗式代码审查 / 反方论证 / 双模型评审（`epi` + `gpt-6.1-sol`）**：
  ```bash
  hc send "$CHILD_TERM" "cd $(pwd) && epi --approve --model factory/gpt-6.1-sol --thinking high '<审查提示词>'"
  ```
- **Claude Code**：
  ```bash
  hc send "$CHILD_TERM" "cd $(pwd) && claude '<任务提示词>'"
  ```

#### 发给右屏子窗口的固定任务契约
给 `$CHILD_TERM` 的提示词必须要求它按**证伪者**而非“啦啦队”工作：
1. **跑真实检验**：能跑真实脚本、真实样本重放或只读查询的，绝不只做静态肉眼读代码。
2. **穿透单一绿灯（What Green Proved vs. Missed）**：单条样本跑通后，追问“这个绿灯只证明了什么？全量分布或边界条件下会不会失效？”（例如检查全量历史产物比例、时间戳先后、静默降级分支）。
3. **盲区与隐式决策自检（Did I miss anything?）**：挑出实现里替用户暗自做掉的决定（默认值、被吞掉的报错、两难冲突时的取舍）。
4. **证据先行写入 `/tmp/herdr-<task>/report.md`**：
   - 先贴实际执行的命令与原始输出关键片段/数字，再写结论；
   - **禁止执行 `hc send` 回传主窗口**。

#### 主窗口等待循环
```bash
while true; do
  WAIT_OUT=$(hc wait "$CHILD_TERM" 2>&1)
  echo "$WAIT_OUT"
  if ! printf '%s' "$WAIT_OUT" | grep -q "still running:"; then
    break
  fi
done
```

### 第三步：回收与汇报（左屏主窗口 — 证据先行，守护用户注意力）

右屏跑完后，主窗口**先读原始命令输出与报告文件核对事实**，再用高信息密度结构向用户汇报（砍掉修饰性套话）：

1. **结论与实测证据（Evidence First）**：跑了什么真实命令、关键数字/产物路径是什么。
2. **假设 vs 实测（Hypothesis vs. Reality）**：原假设是否成立；实测抓到了什么反例、未上线差异或历史数据阻塞点。
3. **绿灯边界（What Was Proven vs. Unchecked）**：这次测试实际覆盖了什么，**还有哪 1–2 个边界没测到**。
4. **隐含决策与需拍板项（Accountability Focus）**：把代码/方案暗自替你决定的地方（静默兜底、范围取舍、兼容性闸门）单独拎出来，让你只把注意力花在真正需要你签字负责的判断上。

---

## 3. 多轮追问与分屏生命周期

- **同分屏多轮追问**：右屏 Agent 处于 `done` 状态时，直接 `hc send "$CHILD_TERM" "..."` 追加下一轮边界验证，无需重开分屏。
- **默认保留右屏**：测试结束后保留右屏不关，供用户随时回看终端原始上下文或直接在右屏提问；仅在用户明确要求关闭时执行 `herdr-app do pane.close --pane "$CHILD_PANE"`。
