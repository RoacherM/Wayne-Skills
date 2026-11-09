---
name: nowledge-mem
description: 用 nmem 命令行读写 Nowledge Mem 记忆：开工时读上下文，搜以前的记忆和对话，把值得长期记住的结论存成记忆，查连接状态。用户提到上次、之前、以前怎么做的、记住这个、记忆、Working Memory、nmem、Nowledge，或接手一个有历史的功能、bug、发布、评审时使用。对话由后台自动同步，不要手动存整段对话。
---

# Nowledge Mem（nmem 命令行）

所有读写都用 `nmem --json`。本机 Mem 服务在 `http://127.0.0.1:14242`，不需要 key。

下文的 `<工具名>` 是你自己：`claude-code`、`codex`、`pi`、`grok`、`devin`、`antigravity` 之一。

## 0. 先确认能用

`command -v nmem` 找不到，或 `nmem status` 失败时：停下，告诉用户跑
`bash ~/Projects/sides/wayne-skills/global/nowledge/apply.sh`。
不要自己用 pip 或 uv 安装 nmem，不要改 `~/.nowledge-mem/config.json`。

## 1. 开工时读上下文（每个会话一次）

```bash
nmem --json context read --source-app <工具名>
```

失败时退回 `nmem --json wm read`。结果为空是正常的，不算失败。

## 2. 搜

这些时候先搜一次再下结论：续做某个功能、bug、重构或发布；评审、回归；用户说「上次」「之前那个办法」；排错的现象像以前见过。

```bash
nmem --json m search "<问题>" -n 5               # 长期知识；问原因、来龙去脉、跨主题时加 --mode deep
nmem --json t search "<关键词>" -n 5             # 以前的对话
nmem --json t show <thread_id> -n 8 --offset 0 --content-limit 1200   # 只读命中对话里需要的几条
```

结果里有 `source_thread` 时，用第三条命令看原对话。用最少的检索回答问题。搜不到或出错就直说，不要编。

## 3. 存

存：做出的决定和理由；踩过的坑和根因；验证过的做法；用户明确说过的偏好。
不存：临时进度；从代码或 git 能直接看到的事；密钥、token、个人隐私。

```bash
nmem --json m add "<结论 + 原因 + 适用范围，单独读也能看懂>" -t "<短标题>" -i <0.3–0.9> --source-app <工具名> -l <项目名>
```

存之前先 `m search` 一次。已有相近的记忆时，用 `nmem m update <id>` 改它，或用 `nmem m supersede` 把旧记忆连到新记忆，不要重复存。
用户说「记住这个」时直接存，然后报告标题和 id。

## 4. 对话不用手动存

后台任务每 10 分钟用 `nmem t sync` 同步上面 6 个工具的本地对话。
用户要求「现在就存这段对话」时：

```bash
nmem t sync --from <工具名> --all-projects --limit 1 --apply
```

## 5. 查状态

- `nmem doctor`：连接、服务、key。
- 后台同步日志：`~/Library/Logs/nmem-capture.log`。
- 后台任务没装或坏了：让用户跑 `bash ~/Projects/sides/wayne-skills/global/nowledge/apply.sh --check`。
