---
name: herdr
description: >
  在 Herdr 里控制分屏、终端和其他 Agent。两种 Herdr 都管：Herdr.app（`herdr-app` + `hc`，
  有我的分屏开发流程：日常左 1 + 右 2，按需加开 Reviewer）和终端版 `herdr`。
  用户提到 Herdr、Herdr.app、herdr-app、hc、分屏、开个分屏、子窗口测试、分屏 review、右边窗口跑一下时使用。
  只是任务适合并行或后台跑时不要用。
---

# Herdr

有两种 Herdr，命令完全不同。先判断自己在哪种里面，再动手：

| 检查 | 在哪里 | 做什么 |
|---|---|---|
| `test -n "${HC_TERMINAL_ID:-}"` | **Herdr.app**（图形窗口，`herdr-app` 管窗口和分屏，`hc` 管终端和 Agent） | 先跑 `herdr-app --skill` 和 `hc --skill`，再读 [references/herdr-app.md](references/herdr-app.md)，按里面的布局、角色和规则做 |
| `test "${HERDR_ENV:-}" = 1` | **终端版 herdr**（终端界面多路复用器） | 跑 `herdr --skill`，按它打印的官方说明做 |
| 两个都不成立 | 不在 Herdr 里 | 停下，告诉用户。不要从外面操作别人的 Herdr 会话 |

`herdr-app --skill`、`hc --skill`、`herdr --skill` 打印的是和本机安装版本对应的官方手册，命令写法以它们为准。references 里的内容和手册冲突时，以手册为准，并告诉用户这里过时了。

两种 Herdr 的命令不要混用：在 Herdr.app 里不要跑 `herdr`，在终端版里不要跑 `herdr-app` 或 `hc`。
