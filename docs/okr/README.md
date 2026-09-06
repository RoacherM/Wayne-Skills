# okr

目标与任务追踪，终端里看，agent 也能读写。事件进，视图出。设计见同目录 `DESIGN.md`，agent 读写规则见 `PROTOCOL.md`，skill 在仓库根的 `skills/okr/`（给日常对话 agent：理解、记录、验收、拆解；执行 agent 侧暂无单独 skill，派工时把协议 §9 一起交给它），用 `npx skills add` 装给各个 coding agent。CLI 和 skill 同一个仓库、同一个版本。

- 数据只有两个文件：`~/.okr/nodes.yaml` 是节点树，`~/.okr/events.jsonl` 追加事件。每次写入自动 git commit，git 只做历史和备份，状态永远从文件推导。
- 节点树任意深度：`objective` 目标 → `metric` 指标（76 → 95）/ `milestone` 里程碑 → `task` 任务。`habit` 习惯平铺，无父的 task 是临时待办。
- 任务有阶段（待办 / 进行中 / 阻塞 / 待验收 / 完成）和计划周两个维度，都从事件和字段推导。任务带 `spec`（目标、验收、验证、链接），spec 齐了才能派给执行 agent。
- 上层节点进度按子节点加权推导；agent 可以 `assess` 覆盖，子树一有 done / reject / submit / change 就标过期，推导值并排显示，不替换。
- 健康度 agent 改不了：进度减时间流逝算缺口；任务只有标签（到期、将到期、阻塞、停滞、待验收超时、已领取、遗留）。

## 安装

打包好的 CLI（skill 里的 `scripts/okr.js`）只要 Node ≥ 20；从源码跑（仓库 checkout、`npm link`）要 Node ≥ 23.6，TypeScript 由 Node 原生剥离。

```bash
npx -y --no-audit skills add RoacherM/Wayne-Skills -s okr -g -y -a claude-code -a codex   # 装 skill，CLI 打包在 skill 的 scripts/okr.js 里（Node ≥ 20），-a 选 agent
node ~/.agents/skills/okr/scripts/okr.js skill link                                        # 想在终端敲 okr：软链到 ~/.local/bin
okr tui --demo                                                                             # 先用示例数据看看
```

另一条路是 `npm install -g github:RoacherM/Wayne-Skills`（`okr` 进 PATH，更新重跑同一条）：任意 `okr` 命令运行时会检查 skill，没有就把 `skills/okr` 复制到 `~/.agents/skills/okr`（Codex / Copilot / OpenCode 直接读），并建软链 `~/.claude/skills/okr`（Claude Code）；是自己装的拷贝（带 `.wayne-skills` 戳记）且包里的 skill 变了就更新；软链或别人装的目录不碰。手动：`okr skill install [--force]` / `remove` / `status`；`OKR_SKIP_SKILL=1` 关掉自动安装（不用 npm postinstall 是因为 npm 11 会把带安装脚本的 git 全局包装成指向临时 clone 的软链）。别的 agent 就在 skills CLI 那条命令里多加 `-a gemini-cli` 之类（`--no-audit`：首次拉包时 npm audit 在某些网络下会静默挂住）。agent 用 `okr protocol` 读协议，不依赖仓库路径。

本地开发：

```bash
git clone https://github.com/RoacherM/Wayne-Skills ~/Desktop/Projects/sides/wayne-skills && cd ~/Desktop/Projects/sides/wayne-skills && npm install && npm link   # okr 指向源码（Node ≥ 23.6）；覆盖 npm install -g 装的那份，回发布版重跑 npm install -g。改了 src/ 或 PROTOCOL.md 后 npm run bundle 重新打包 skills/okr/scripts/okr.js
rm -rf ~/.agents/skills/okr && ln -s ~/Desktop/Projects/sides/wayne-skills/skills/okr ~/.agents/skills/okr && okr skill install   # skill 用软链，改 SKILL.md 即生效；install 只补 Claude Code 软链
npm test && npm run typecheck
okr tree --demo && okr show kr1.2 --spec --demo   # 派工包长什么样
```

## 用法

```bash
okr init
okr add o1  --name 推荐系统上线 --kind objective --area 工作 --start 2026-07-01 --end 2026-09-30 --confirmed
okr add kr1 --name 模型精度 --parent o1 --metric %:76:95 --weight 2 --confirmed
okr add     --name 用户分群特征 --parent kr1 --kind task --priority P1 --deadline 2026-09-05 --week 2026-W36 \
            --goal "…" --accept "AUC +0.5" --accept "单测通过" --verify "make test" --link https://…/issues/12 --confirmed
okr add h1  --name 跑步 --kind habit --cadence 3/week --confirmed

okr log kr1 "基线跑完" --value 80              # metric 数值只由用户口述
okr claim kr1.1 --by codex --session wt-a     # 执行 agent 领取
okr submit kr1.1 --link https://…/pull/421    # 进「待验收」
okr reject kr1.1 "少了单测"                     # 回「进行中」
okr done kr1.1 --hours 3
okr done kr1 --confirmed                      # KR / 目标 / 里程碑的完成要用户点头
okr assess o1 --value 40 --reason "kr1 到 80，m1 阻塞"
okr check h1 --at 2026-09-01                  # 补记打卡
okr block m1.1 "等数据接口"

okr edit kr1.1 --priority P0 --week none      # none 清空字段
okr move kr1.3 --to m1 --confirmed
okr rm t9 --confirmed                         # 只删没事件（自身 add/edit 的 change 除外）、没子节点、没人依赖的节点，其余 edit --status canceled
okr repo add ~/Projects/recsys --node kr1

okr             # TUI：看板 / 树 / 本周 / 报告 / 事件，⏎ 钻进节点详情或打开报告
okr status      # 看板
okr tree --all  # 树，含已完成和已取消
okr show o1     # 详情：燃起图、评估、子节点、事件
okr show kr1.2 --spec   # 派工包 markdown，带可复制的 claim / log / submit 命令
okr recent --days 7     # 最近事件
okr week                # 本周：计划、遗留、待确认提案、近 4 周吞吐
okr report list         # reports/ 与 logs/ 里的周报、周计划、日报
okr status --md         # 任何看板类命令都能出 markdown；管道里默认 80 列纯文本，--width 120 改宽，--ansi 强制颜色
okr velocity            # 近 4 周完成数与用时
okr brief               # 会话开始先看：逾期 / 将到期 / 阻塞 / 停滞 / 待验收超时 / 已领取 / 上层落后 / 待确认提案
okr week [--week W]     # 某周的计划（按 order）和遗留
okr candidates [--dispatchable]   # 未完成任务和排序依据：截止、所属 KR 落后多少、依赖、遗留、spec 缺什么
okr changes --since last-daily    # 上次日报以来写了什么（按记录时间算，补记的也在）
okr commits --since last-weekly   # 登记仓库的 git log
okr apply --from 2026-W36.plan.yaml --confirmed   # 落周计划（reports/ 下的提案文件）；--dismiss 否掉待处理提案
okr report data --week 2026-W36   # 周报数据：各节点本周进度变化、完成的任务、事件计数、计划、brief
okr report write --kind weekly --from w36.md   # 把写好的报告存进 reports/ 并记 report 事件；report status 看今天 / 本周写没写
okr deliver notes --from w36.md   # 推到 Apple 备忘录（同名更新）；--probe 只做授权测试
okr job install                   # 装 launchd 日报（每天 11:00）/ 周报（周一 10:00），无头 claude/codex 写正文；job status / remove / run daily --dry-run
okr protocol            # 打印 PROTOCOL.md，agent 先读它
okr validate            # 数据、iCloud 冲突副本、git 健康
okr migrate             # 旧 goals.yaml 迁到新模型
```

节点可以用 id 或名字关键词指代。匹配到多个时列出候选并退出码 2，不猜；没有匹配也是退出码 2（`--json` 里 `candidates` 为空）。

通用参数：`--json`（读写都支持，错误也是 JSON）、`--today 2026-03-15`（只影响读，写命令传了直接拒绝）、`--at`（补记时间，给日期就是那一天，晚于今天或晚于当前 5 分钟以上的时间拒绝）、`--by`（缺省 `OKR_BY`）、`--session`、`--confirmed`、`--force`、`--demo`。时间戳一律要求本地时区显式偏移（如 `+08:00`），别的格式会被自动规整。`OKR_DIR=…` 换数据目录。不认识的 `--flag` 直接拒绝。人类输出三种：终端里 ANSI；管道、`NO_COLOR` 或 `--plain` 是 80 列纯文本（`--width N` 改宽）；`--md` 是 markdown（status / tree / show / week / velocity / recent / changes / report list），图表放在代码块里；`--ansi` 强制颜色。冻结 / 取消的节点（含继承自祖先）默认拒绝事件类写入（log / done / claim 等），`--force` 放行；add / edit / move 不受影响。退出码：0 成功，1 错误，2 指代歧义，3 守卫拒绝或 validate 失败，4 锁超时。

TUI 页签：看板、树（目标带本周变化 ▲▼）、本周（计划 / 遗留 / 提案 / 吞吐）、报告（周报 / 周计划 / 日报，⏎ 阅读，阅读时 `←→` 翻上一份 / 下一份）、事件。按键：`←→` 或 `Tab` 切页（也可按 `1`–`5`），`↑↓` 选节点或滚动，`PgUp/PgDn` 翻页，`⏎` 看详情或打开报告，`esc` 返回，`a` 树页显示已完成，`/` 筛选（`esc` 清除），`r` 重新读取，`q` 退出。

## 结构

```
bin/okr.js      启动器；装在 node_modules 下时自己剥离 TypeScript 类型
src/
  types.ts      节点、事件、推导状态的类型
  dates.ts      本地日期、ISO 周、时间戳
  store.ts      读写 nodes.yaml / events.jsonl / repos.yaml，写锁，git commit
  project.ts    从节点树和事件流推导阶段、进度、评估、健康度、标签、派工条件
  validate.ts   数据校验与目录校验（iCloud 副本、git fsck）
  migrate.ts    旧 goals.yaml 迁移
  demo.ts       示例数据
  render.ts     输出格式判定（ansi / plain / md）与去色
  views/        common · tree · status 看板 · detail 详情（含依赖链）· deps · week 本周 · velocity 吞吐 · reports 报告列表与阅读 · habit 热力图 · events 事件流 · md 各视图的 markdown
  tui.ts        全屏页签式交互
  cli.ts        命令入口、守卫、输出（含 okr protocol）
test/           node --test
docs/okr/       本文档、DESIGN.md、PROTOCOL.md（agent 通用协议）、AGENTS.okr.md（不支持 skill 的 agent 用的片段）
skills/         仓库里的全部 skill，npx skills add 安装（见 skills/README.md）
  okr/          日常对话 agent：记录、看板、计划、派工
```
