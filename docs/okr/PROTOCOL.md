# okr 协议（agent 通用）

任何 agent（Claude Code、Codex、Gemini、执行 agent）替用户读写 `~/.okr` 都按这份文档来。它不依赖某个 agent 的 skill 机制；仓库里的 skill（`okr` 给对话 agent，`okr-executor` 给执行 agent）和 `AGENTS.okr.md` 片段都只是把这份文档接进各自的对话。数据模型、推导规则和守卫的完整定义在 `DESIGN.md`，这里只讲 agent 该怎么做。

## 0. 三句话

1. 只通过 `okr` 命令读写，永远带 `--json`；不直接改 `~/.okr` 里的文件，不在 `~/.okr` 里跑 git。
2. 状态从事件推导，agent 只负责把用户说的话翻成对的事件，写之前先看 `okr recent`。
3. 动结构、标 KR / 目标 / 里程碑完成、落周计划，都要用户点头，点头后才传 `--confirmed`。

## 1. 环境与约定

- 数据目录 `OKR_DIR`，缺省 `~/.okr`。没有 `nodes.yaml` 就先问用户是否 `okr init`（旧 `goals.yaml` 用 `okr migrate`）。
- `--by <agent>` 标记写入者：Claude Code 用 `claude`，Codex 用 `codex`，Gemini 用 `gemini`，执行 agent 用派工包里给的名字。每条命令显式传，不依赖环境变量 `OKR_BY`（agent 的 shell 环境不持久）。
- `--json` 读写都支持，错误也是 JSON（`{ok:false,error,code}`）。人类可读输出只给用户看，agent 解析 JSON。
- 退出码：0 成功；1 一般错误；2 指代歧义或没有匹配（JSON 里带 `candidates`，为空即没有这个节点）；3 守卫拒绝或 validate 失败；4 锁超时（等一秒重试一次，再失败就报给用户）。
- 时间：事件时间 `ts` 缺省为写入时刻。用户说的是之前发生的事（「昨天跑完了」「上周提的 PR」），传 `--at 2026-09-02`（日期取当天中午，今天取当前时刻）或完整本地时间 `--at 2026-09-02T21:00:00+08:00`。未来时间会被拒绝。
- `--today` 只给读命令做「假装今天是」用，写命令传了会被拒绝。`--demo` 是只读示例数据。
- 节点可以用 id 或名字关键词指代。CLI 匹配到多个会退出码 2 并列出候选，agent 把候选列给用户选，不自己猜。
- 不认识的 `--flag` 会被拒绝，别自己发明参数。

### 命令实现状态

DESIGN.md §8 分五步开发，目前到第 2 步。协议按最终形态写，下表标明哪些命令已经能用，没到位的先用替代。

| 命令 | 状态 | 未实现时的替代 |
|---|---|---|
| `init` `add` `edit` `move` `rm` `tree` `show [--spec]` `validate` `migrate` `repo add\|rm\|list` | 可用 | |
| `log` `done` `block` `claim` `submit` `reject` `assess` `check` `recent` | 可用 | |
| `status` `velocity` `protocol` | 可用 | |
| `tui` | 可用，仅限终端 | 需要 TTY，agent 环境下退出 1，agent 用 `status` / `tree` |
| `brief` | 待实现（§8 步 3） | `okr tree --json` 过滤 task 的 `flags`（overdue / due-soon / blocked / stale / review-stale / claimed / carry-over）；`okr status --json` 只有根节点，看 `health`；`okr recent --days 7 --json` 看动静 |
| `week` | 待实现 | `okr tree --json`，过滤 `planned` 或 `carryOver` 为 true 的 task，按 `order` 排（没设 `order` 的没有这个字段，排最后） |
| `candidates [--dispatchable]` | 待实现 | `okr tree --json`，过滤 task 的 `stage != done`，`dispatchable` 字段已有 |
| `apply --from plan.yaml` / `--dismiss` | 待实现 | 用户确认提案后逐条 `okr add … --week … --confirmed` 与 `okr edit <id> --week … --order N` 落地 |
| `commits` `changes` `report` `deliver notes` | 待实现（§8 步 3–4） | 需要提交列表时 agent 自己 `git -C <repo> log --since` |

## 2. 会话开始

先跑 `okr brief --json`（未实现前按上表替代）。有事才提一句，没事不说：到期与将到期、阻塞、停滞、待验收超过 3 天、已被执行 agent 领取的任务、待确认的周计划提案。

有待确认提案（`week --json` 的 `proposal` 为 `pending`）：提醒用户确认，用户点头就 `apply --from <file> --confirmed`，否掉就 `apply --dismiss`。

## 3. 写之前

1. **指代**：确定目标节点。用户说的名字不唯一就把候选列出来问，不猜。
2. **查重**：`okr recent --node <id> --days 7 --json`。CLI 只拿节点的上一条事件比：同一天、同类型、字面相近才拒，中间隔了别的事件就不拦（habit 的 `check` 例外，同一天只收一次）；「用户上午说了 AUC 到 0.8，下午又提一遍」这类语义重复是 agent 的事，已经记过的不再写。用户明确说「再记一条」才加 `--force`。
3. **归属**：这句话属于哪个任务、哪个 KR，由 agent 判断。看树（`okr tree --json`）、看仓库的 `.okr.yaml`、看最近事件。判断错了直接改：事件不删，补一条正确的，`note` 里说明「上一条记错节点」。
4. **数值只由用户口述**：metric 的 `--value`、任务的 `--hours`，用户没说就不写，不要从 PR、日志或上下文推算。「应该到 90 了吧」这类猜测语气先确认是不是实测值，确认前不写。

## 4. 用户的话 → 事件

| 用户说 | 写什么 |
|---|---|
| 有进展、做了点什么、纠正之前的数字 | `okr log <id> "一句话" [--value N] [--hours N] [--link URL]` |
| metric 到了某个值 | `okr log <kr> "来源或依据" --value N`。value 是 metric 单位的绝对值，不是百分比 |
| 任务做完了 | `okr done <task> [--hours N]` |
| KR / 目标 / 里程碑完成了 | 先问「确认 <名字> 完成？」，用户点头后 `okr done <id> --confirmed` |
| 卡住了、等人、等接口 | `okr block <id> "卡在哪"`（只对 task / milestone） |
| 不卡了、恢复了 | `okr log <id> "解除阻塞：…"`。任一阶段事件都解除阻塞，不需要专门命令 |
| 验收不通过、要改 | `okr reject <task> "意见"`，任务回进行中，`claimed` 清空，重派要执行 agent 重新 `claim` |
| 已完成的任务要重新打开 | `okr reject <id> "原因"`；非 task 加 `--confirmed` |
| 习惯打卡 | `okr check <habit> [--at 日期]` |
| 习惯不做了 | `okr edit <habit> --status canceled --confirmed`（习惯没有 done） |
| 暂停一个目标 / 恢复 | `okr edit <id> --status frozen` / `--status active` |
| 取消 | `okr edit <id> --status canceled --confirmed` |

冻结或取消的子树默认拒绝事件类写入（退出码 3）。遇到就告诉用户这个节点已冻结 / 取消，问是解冻还是照记（照记加 `--force`），不要自作主张 `--force`。

## 5. 上层进度与 assess

- 上层节点（objective / milestone）的进度默认信 CLI 推导（`derived`）。metric 的进度来自最近一条带 `value` 的 progress，不能 assess。
- 只在**不同意推导值**时写 `okr assess <id> --value 0-100 --reason "…"`。理由必须引用具体任务和 KR 的状态，例如「kr1 已到 86，m1.1 接口阻塞两周，整体略落后」。没有理由会被拒绝。
- 节奏：周报时统一评估一次。不要每次 done 都 assess。同一节点同一天同值、理由相近的 assess 会被去重；当天改数值可以直接写。
- assess 之后子树内出现 done / reject / submit / change 就过期。视图会并排显示旧 assess 与新推导值，agent 看到过期不用急着补，等下次周报。

## 6. 拆解与周计划

**什么时候拆**：建目标时、做周计划时、任务开工前、卡住时。

**怎么拆**：先在对话里展示提案（任务名、优先级、截止、所属、一句为什么），用户确认后再落盘。当天的步骤只在对话里说，不写进 okr。

**落盘方式**：写 `reports/<周>.plan.yaml`（周报提案）或 `reports/<周>.plan-2.yaml`、`plan-3.yaml`（中途拆解，不覆盖周报提案），然后 `okr apply --from <file> --confirmed`。`apply` 未实现前用逐条 add / edit 落地（见 §1 表）。

```yaml
week: 2026-W36
new:                        # 新建任务，字段同节点；id 可省略
  - {id: kr1.3, parent: kr1, name: 特征 v3, priority: P1, deadline: 2026-09-05, spec: {...}}
  - {parent: kr1, name: 评测脚本, priority: P2}
plan: [t41, kr1.3, new:1]   # 本周全集，按优先顺序；new:N 引用 new 列表下标，0 起算
drop: [t39]                 # 遗留任务退出本周，清空 week
```

每个遗留任务（`week` 早于本周、未完成、active）必须出现在 `plan` 或 `drop` 里，否则 apply 拒绝并列出。

**任务粒度**：一个 PR 装得下，用户一次能审完。派给执行 agent 的任务 `spec` 四项要齐：`--goal`（做什么、动哪个仓库和模块、明确不动什么）、`--accept`（可重复，逐条验收标准）、`--verify`（提 PR 前必须通过的命令）、`--link`（文档、issue、之前的 PR）。

**排序依据**（算法在 agent，CLI 只给事实）：截止和权重、落后最多的 KR、依赖链（被依赖的先做）、用户近期吞吐（`okr velocity --json`）。今日清单从本周任务里挑，按顺序列完，每条一句为什么。

## 7. 结构变更

`add` / `move` / `rm` / `apply` 都要 `--confirmed`。`--confirmed` 是「用户点过头」的记录，不是防线：agent 先把要做的事说清楚，用户同意后才传。`edit` 改字段不需要；把 `status` 改成 canceled CLI 不强制，但协议上要用户点头，点头后同样带 `--confirmed` 记入审计。

- `okr add --name … --kind objective|metric|milestone|task|habit --parent <id> …`。有 `--parent` 也要显式 `--kind`，只有 `--metric 单位:from:to` 或 `--cadence 3/week` 能推出 kind。
- objective / metric / milestone 字段：`--area` `--start` `--end` `--weight` `--status active|frozen|canceled`；metric 还有 `--metric 单位:from:to`（或 `--unit` `--from` `--to`），habit 有 `--cadence`。
- 任务字段：`--priority P0-P3` `--deadline` `--week 2026-W36` `--order` `--dep <id>`（可重复）`--goal` `--accept` `--verify` `--link`。
- `--week none` 这类 `none` 清空字段。
- `rm` 只能删没有事件、没有子节点、没人依赖的节点，其余用 `edit --status canceled --confirmed`。
- id 由 CLI 生成（`kr1.3`、`t7`），不复用，`--json` 里回显；后续指代用 id。
- deps 成环会被拒绝。

## 8. 仓库关联

- 用户说「这个仓库对应 kr1」：`okr repo add <path> --node kr1`。`okr repo list --json` 看登记。
- 仓库根目录可以放 `.okr.yaml`，声明默认节点，让在仓库里干活的 agent 知道往哪记：

```yaml
node: kr1          # 这个仓库的工作默认记到哪个节点
```

  CLI 不读这个文件，agent 读。在仓库里收到「记一下进度」但没点名节点时，先看它。
- 从 git 提取进度：CLI（`okr commits`，待实现）只列提交，归纳是 agent 的事，归纳结果写成一条 `log`，不是一条提交一条事件。时机：用户完成一个大版本让 agent 更新，或用户让 agent 汇总某个仓库。

## 9. 派工与执行 agent

派工暂时手动：用户点名任务，自己开窗格和 worktree，把 `okr show <id> --spec` 的输出整段喂给执行 agent。派工包包含 spec 四项、所属、阶段、依赖及各自完成状态（`[x]` 已完成、`[ ]` 未完成；JSON 里是 `deps[].done`）、历史 submit 链接、每次 reject 的意见，以及可照抄的回写命令。

`show --spec` 给的任务如果 `dispatchable` 为 false（spec 不全或依赖未完成），先补 spec 或等依赖，不派。

**执行 agent 契约**（拿到派工包的 agent 只做这四件事，其他一律不碰）：

1. 开工先 `okr claim <id> --by <agent> --session <session>`。`--session` 自定（worktree 名即可）。已被别人领取且未 submit 会被拒绝，回报用户，不 `--force`。
2. 卡住 `okr block <id> "卡在哪" --by … --session …`。
3. 解除阻塞或关键进展 `okr log <id> "…" --by … --session …`。日常小步骤不记。
4. 派工包里的验证命令通过、PR 提了，`okr submit <id> --link <PR> --by … --session …`。没有 link 会被拒绝。

执行 agent 不写 `done`、`assess`、`add`、`edit`，不填 `--value` `--hours`。验收由用户做：通过 `okr done`，不通过 `okr reject "意见"`，同一任务继续，重派时派工包会带上打回意见。

## 10. 守卫被拒时怎么办

| 退出码 / 报错 | 做法 |
|---|---|
| 2 歧义，带 `candidates` | 非空就列给用户选；为空说明没有这个节点，问用户是不是要新建 |
| 3 「内容相近」 | 默认当重复，告诉用户已记过；用户坚持再 `--force` |
| 3 已冻结 / 已取消 | 告诉用户，问解冻还是照记 |
| 3 需要 `--confirmed` | 把要做的事说给用户，点头后加上重跑 |
| 3 已被领取 | 回报是谁（`by` / `session`）领的 |
| 3 submit 缺 link / assess 缺 reason / assess 值超出 0–100 | 补齐再写，不要绕 |
| 1 `--value` / `--hours` 不是数字、参数格式错 | 改对参数重跑 |
| 4 锁超时 | 等一秒重试一次 |
| `committed: false` | 文件已写入，只是 git 提交失败，提醒用户跑 `okr validate` |

## 11. 报告（§8 步 4 之后由定时任务触发）

日报由脚本判断有没有更新，有更新才叫 agent 写：待确认提案提示、今日顺序及理由、到期与阻塞、待验收与已领取、建议拆解、昨日进度。周报 agent 写全文：上周回顾、各目标评估与周变化、吞吐、本周提案（同时写 `plan.yaml` 等用户确认）、风险。图用文本块。

## 12. 不做的事

- 不直接编辑 `nodes.yaml` / `events.jsonl`，不在 `~/.okr` 里 git commit / checkout / reset。
- 不推算 metric 数值和用时。
- 不替用户确认：结构变更、KR / 目标 / 里程碑完成、周计划落地、`--force`。
- 不每次 done 都 assess，不把当天的步骤写进 okr。
- 不把提交一条条记成事件。
- 执行 agent 只写 claim / block / log / submit。
