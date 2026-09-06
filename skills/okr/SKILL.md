---
name: okr
description: "通过 okr CLI 替用户记录目标 / KR / 任务 / 习惯的进展并做周计划。触发：/okr；用户提到 OKR、KR、目标进度、指标到了多少、任务做完了 / 卡住了 / 提了 PR、习惯打卡、周计划、拆任务、派工、看板 / 进度怎么样；英文 'okr', 'kr progress', 'mark done', 'blocked', 'weekly plan', 'dashboard'。用户没说 OKR 但在汇报某个已登记目标的进展时也用。执行 agent 拿到派工包回写 claim / block / log / submit 也走这里。"
---

# okr

用户的目标与任务追踪在 `~/.okr`，命令行工具 `okr` 就在本 skill 目录的 `scripts/okr.js`（单文件，Node ≥ 20；仓库 github.com/RoacherM/Wayne-Skills）。下文所有 `okr …` 都指：PATH 上有 `okr` 就用它，否则 `node <本 skill 目录>/scripts/okr.js …`。规则全部在协议文档里，先读它再动手：

```bash
okr protocol
```

没有 `~/.okr/nodes.yaml`：问用户是否 `okr init`，旧 `goals.yaml` 走 `okr migrate`。

## 本 skill 固定的事

- 写入一律带 `--by <自己的名字> --json`（Claude Code 用 `claude`，Codex 用 `codex`，Gemini 用 `gemini`），读也 `--json`，自己解析后用中文一句话回用户。
- 会话里第一次碰 okr 先按协议 §2 跑 `okr brief --json`，`empty` 为 true 就不提，否则挑要紧的一句。
- 每次写之前 `okr recent --node <id> --days 7 --json` 查重，语义重复不写。
- 指代歧义（退出码 2）列候选让用户选；需要 `--confirmed` 的事先说清楚再等用户点头；被守卫拒绝（退出码 3）按协议 §10 处理，不自作主张 `--force`。
- 数值（`--value`、`--hours`）只写用户口述的。

## 意图 → 协议章节

| 用户在做什么 | 看协议 | 典型命令 |
|---|---|---|
| 汇报进展、指标、完成、阻塞、打卡 | §3 §4 | `okr log` `done` `block` `check` |
| 验收执行 agent 的 PR | §4 §9 | `okr done` / `okr reject "意见"` |
| 问进度、看板、哪些落后 | §2 | `okr tree --json`（task 的 `flags` / `stage` 只在这里和 `show` 里）、`okr status --json`（根节点）、`okr show <id> --json` |
| 评估某个目标到了几成 | §5 | 默认信推导；不同意才 `okr assess --value --reason` |
| 建目标、拆任务、做周计划、今日清单 | §6 §7 | `okr week --json` + `okr candidates --json` 取数 → 展示提案 → 用户点头 → 写 `reports/<周>.plan.yaml` + `okr apply --from … --confirmed`；否掉就 `okr apply --dismiss` |
| 写日报 / 周报、推到备忘录、装定时任务 | §11 | `okr changes --since last-daily --json` / `okr report data --json` 取数写 markdown → `okr report write --kind daily\|weekly --from <md>`；`okr deliver notes --from <md>`；用户要自动化就 `okr job install`（会触发备忘录授权，让用户自己跑） |
| 改结构：加、改、挪、删、取消、冻结 | §7 | `okr add/edit/move/rm … --confirmed` |
| 「这个仓库对应哪个 KR」、汇总仓库进度 | §8 | `okr repo add <path> --node <id>`，读仓库 `.okr.yaml` |
| 派任务给执行 agent | §9 | `okr show <id> --spec`，整段贴给执行 agent |
| 自己就是执行 agent（拿到派工包） | §9 | 按契约只写 `claim` `block` `log` `submit --link`，带 `--by` `--session`，不写 `done` / `assess` |

## 回复格式

- 写入成功：一行，说记到了哪个节点、什么事件，附推导变化（写命令的 `--json` 返回里就有 `progress` / `stage`，写前 `show --json` 拿一次基线即可）。例：「记到 kr1：精度 86%（53% → 58%）」。
- 多条更新一句话里：先解析成列表给用户看，确认后按顺序写，逐条一行。
- 看板：`okr status` / `okr tree` / `okr week` 在管道里就是 80 列纯文本，原样贴给用户即可（要 markdown 加 `--md`，写报告时也用 `--md`），再补一两句要关注的。
- 提案：任务名、优先级、截止、所属、一句为什么；不要在用户确认前写入。

## 派工

用户点名派工时：`okr show <id> --spec --json` 检查 `dispatchable`；不可派就先补 spec（问用户 goal / accept / verify / link）。可派就把 `okr show <id> --spec` 的 markdown 原样交给执行 agent（用户自己开的窗格 / worktree 里的 codex 或 claude），并告诉它 `--by` 用什么名字、`--session` 用 worktree 名；并把协议 §9 的执行 agent 契约一起交给它（执行侧暂无单独 skill）。之后用 `okr show <id> --json` 的 `claimed` / `stage` 跟进。
