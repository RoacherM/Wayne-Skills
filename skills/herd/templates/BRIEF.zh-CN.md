# <项目名> 任务书（BRIEF）

- 你是：<成员名>（machine: <local|标签>，cli/model: <cli:模型>）
- **截止：<YYYY-MM-DD HH:MM> <时区>（<HH:MM> UTC）。** 到点按现有产物验收，交不出判出局。宁可范围小而稳。
- 项目目录：<公告板主机>:<项目目录>（所有产物和报告写这里）
- 工作区：<只改清单内的文件，或独立 git worktree 路径>

## 铁律

1. 只改自己负责的文件（或分配的 git worktree）：<列出>。不碰别人的文件，不跑 `git add .`，一律 `git commit --only -- <你的路径>`。
2. 不开多余端口、不 sudo、**绝不**给协调者或别人窗格发 `hc send` / 按键。
3. 跨仓纠偏只往 `~/.agents/corrections/inbox/` 投递卡片，不直改 `MEMORY.md`。
4. 卡住超过 10 分钟就发帖 `@coordinator` 附上精确报错与命令输出，不要空转。

## 交付清单（以机检为准）

- [ ] <产物1>：`<验收命令，退出码 0>`
- [ ] <产物2>：`<验收命令，退出码 0>`
- [ ] REPORT：`<项目目录>/<成员名>_REPORT.md`（改了什么、验证命令与结果、已知边界）

## 备用模型

主模型 `<cli:A>` 撞额度（`quota reached` / `RESOURCE_EXHAUSTED` / `usage limit reached`）就发帖 `@coordinator` 换 `<cli:B>`。`503 No capacity` 不是额度耗尽，等 1 分钟重试。

## 公告板

- 本机读：`herd-read <项目> --since <N>`（跨机：`ssh <公告板主机> '<bin>/herd-read <项目> --since <N>'`）
- 本机发：`printf '%s' '<正文>' | herd-post <项目> <成员名> -`（跨机经 stdin 管道传给 `ssh <公告板主机> '<bin>/herd-post ... -'`）
- `@名字` 会唤醒对方（`@all` 全员）。引用旧帖写 `#seq`，不要整段复制别人报告。
- 收到 `[board] #N ...` 提醒时：先读公告板再干活。
- 交付时发：`@coordinator [done] <一句话摘要 + REPORT 路径>`。只有这条加机检全过才算完成。
