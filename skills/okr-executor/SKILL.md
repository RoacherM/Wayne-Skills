---
name: okr-executor
description: "执行 agent 拿到 okr 派工包（`okr show <id> --spec` 输出的「派工包」/「Spec pack」，带 claim / log / submit 回写命令）后，用 okr CLI 回写领取、阻塞、进展、提交 PR。触发：对话里出现 okr 派工包、用户说「这是派工包」「按 okr 的 spec 做」「做完记得 submit」；英文 'okr spec pack', 'claim this task', 'submit with the PR link'。只做回写，不负责规划或验收，那些在 okr skill 里。"
---

# okr-executor

你是执行 agent：用户（或用户的 okr 助手）把一个任务的派工包贴给了你，你在自己的窗格 / worktree 里把任务做完，并用 `okr` 回写四种事件。规则的出处是协议 §9 / §10，先读：

```bash
okr protocol
```

没有 `okr` 命令：`npm install -g github:RoacherM/Wayne-Skills`（Node ≥ 23.6）。

## 只做这四件事

派工包里已经给了可照抄的命令，`<id>` 就是包里的任务 id。`--by` 用自己的名字（Claude Code 用 `claude`，Codex 用 `codex`，Gemini 用 `gemini`），`--session` 用 worktree 或分支名，四条命令保持一致。都加 `--json`。

1. **开工先领取**：`okr claim <id> --by <agent> --session <session> --json`。退出码 3 且说已被领取：停下回报用户，不 `--force`。
2. **卡住就记**：`okr block <id> "卡在哪" --by … --session … --json`。
3. **关键进展才记**：`okr log <id> "…" --by … --session … --json`。解除阻塞、方案定了、验证跑过算关键；日常小步骤不记。任一事件都自动解除阻塞，没有专门的 unblock 命令。
4. **验证过、PR 提了再提交**：`okr submit <id> --link <PR 链接> --by … --session … --json`。派工包里的验证命令必须先通过；没有 `--link` 会被拒绝。

## 不做的事

- 不写 `done`、`assess`、`add`、`edit`、`move`、`rm`、`check`。验收是用户的事：通过 `okr done`，不通过 `okr reject`。
- 不填 `--value`、`--hours`，数值只由用户口述。
- 不动派工包之外的节点。派工包里 `dispatchable` 为 false（spec 不全、依赖未完成）就先回报，不开工。
- 被守卫拒绝（退出码 3）按协议 §10 处理：冻结 / 取消 / 已被领取都不是你能解决的，回报用户。

## 派工包里要看的

- **验收标准与验证命令**：submit 前逐条自查，验证命令的输出贴进 PR。
- **依赖及完成状态**：`[ ]` 未完成的依赖就别开工，回报。
- **历史 submit 链接与 reject 意见**：重派的任务先把上次被打回的点改掉。被打回后 `claimed` 已清空，重新开工要再 `claim` 一次。

## 回复格式

每次回写一行：「已领取 kr1.2（session wt-a）」「kr1.2 已提交，PR #421」。任务做完的最后一条回复附上 PR 链接和验证命令的结果，方便用户直接 `okr done` 或 `okr reject`。
