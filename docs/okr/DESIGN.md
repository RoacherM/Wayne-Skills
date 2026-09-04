# okr 设计稿

2026-09-03 定稿，同日经三轮审阅后修订（v4）。需求访谈的结论，CLI 和 skill 都按这份实现。生命周期图见 https://claude.ai/code/artifact/664d9e62-2aa0-41f2-a2d8-c2a16de5d983

## 1. 定位

- 记录者是 agent（Claude Code、Codex CLI、Gemini CLI 等），人只看和问。CLI 是给 agent 用的 API，所有命令（含写命令）支持 `--json`。
- 主线是周报（周一 10:00）和日报（每天 11:00）：概览 → 推荐顺序 → 拆解 → 派工执行 → 验收记录。
- 拆解的目的是让 agent 能领走任务自动完成，所以任务规格和进度评估是核心，不是附属。
- 数据是文件，git 只做历史和备份。状态永远从文件推导。
- 数据目录连同 `.git` 一起放 iCloud 同步目录（用户决定，知晓风险）。缓解措施见 §9。

## 2. 数据模型

目录（`OKR_DIR`，默认 `~/.okr`）：

```
nodes.yaml      节点树（目标、KR、里程碑、任务、习惯）
events.jsonl    追加事件
reports/        周报 markdown 与结构化提案：2026-W36.md、2026-W36.plan.yaml、2026-W36.plan-2.yaml
repos.yaml      登记的关联仓库路径
logs/           定时任务日志
.gitignore      排除 iCloud 冲突副本
```

### 节点

任意深度的树。`kind`：`objective` / `metric` / `milestone` / `task` / `habit`。

公共字段：`id`（可省略，CLI 生成：有父节点为 `<父 id>.<序号>`，顶层按 kind 前缀 `o` / `kr` / `m` / `t` / `h` 加序号；生成后不变、全局唯一，move 不改 id；`--json` 里返回）、`name`、`kind`、`parent`（可空，无父的 task 就是临时待办）、`area`、`status`（`active` / `canceled` / `frozen`；完成只由 done 事件表达，节点不记 done）、`start`、`end`（可空）、`weight`（默认 1）。

- `metric`：`unit`、`from`、`to`。数值只由用户口述，agent 不得推算。
- `milestone`：完成必须显式 `done --confirmed`，进度由子任务推导。
- `habit`：`cadence` = `N/week` | `daily` | `N/month`。平铺，不需要父节点。
- `task`：`priority` P0–P3、`deadline`（task 不用 `end`）、`deps`（依赖的任务 id；canceled 的依赖视为已满足，validate 提示）、`week`（计划周标签，如 `2026-W36`）、`order`（本周顺序，apply 写入）、`spec`。`week` 和 `order` 以节点字段为唯一真相；plan 事件只是日志。

### 任务规格 `spec`

四项，全齐才算「可派工」：

```yaml
spec:
  goal: 要达成什么、动哪个仓库和模块、明确不动什么
  accept: [验收标准，逐条]
  verify: 提 PR 前必须通过的命令
  links: [文档、issue、之前的 PR]
```

粒度标准：一个 PR 能装下，用户一次能审完。

「可派工」是推导属性：spec 四项齐全 且 `deps` 全部 done 且 status active 且 stage 非 done。没有单独的标记动作。`candidates --dispatchable` 过滤。

### 事件

每行一条 JSON：`ts`（事件发生时间，带时区 ISO；`--at` 可补记）、`rec`（写入时间，CLI 自动填）、`node`（plan / report 事件为空）、`type`、`note`、`body`（多段正文，可空）、`value`、`hours`（只由用户口述）、`links`、`by`（agent 名，缺省取环境变量 `OKR_BY`）、`session`、`repo`、`commit`、`confirmed`（布尔，审计用）。

`type`：
- `progress` 一句话 + 可选数值。metric 的进度只来自最近一条带 `value` 的 progress。
- `done` 完成。KR / objective / milestone 需 `--confirmed`。done 后再 reject 视为 reopen。
- `blocked` 阻塞，其后任一六种阶段事件即解除。
- `claim` 执行 agent 领取任务，`by` 必填。
- `submit` 执行 agent 提 PR，任务进「待验收」，必带 `links`。
- `reject` 打回，带意见，任务回进行中。对 stage 为 done 的节点即 reopen；非 task 节点的 reopen 需 `--confirmed`。
- `assess` agent 对上层节点的进度覆盖：`value` 为百分比（0–100），`note` 为理由（必填），另记当时的推导值 `derived`（同样是百分比）。只允许 objective / milestone；对 metric 拒绝。视图内部统一换算成 0–1。
- `change` 结构变更日志：add / edit / move / rm / apply 各写一条，`note` 为 diff，`confirmed` 记入。是 assess 过期判定和 `changes` 的依据。
- `plan` 周计划落地日志（apply 写入，含来源文件名与 diff；`--dismiss` 时写空 diff 并标 `dismissed`），`node` 为空。
- `check` 习惯打卡。习惯统计同时计入旧数据里的 `progress` 事件（迁移前的打卡）。
- `report` 报告已生成（`report write` / `deliver notes` 写入，`kind` = daily / weekly），`node` 为空，是 `changes` 和 `commits` 的锚点。

### 任务的两个维度（推导）

**阶段 stage**，只看六种事件：progress / claim / blocked / submit / reject / done。「晚于」按事件在文件里的顺序判定（读入时按 `ts` 稳定排序，同一秒内保持追加顺序），不是单纯比时间戳，所以 `reject` 紧接 `done` 也正确。按下面顺序逐条短路：

1. `done`：最近一条 done 晚于最近一条 reject。
2. `blocked`：末条（六种之内）为 blocked。
3. `review`：最近一条 submit 晚于最近一条 reject。review 期间的 progress 不改变阶段。
4. `doing`：有任一六种事件。
5. `todo`：兜底。

**计划 planned**，独立布尔：`week == 当前周`。

**遗留** carry-over：`week` 早于当前周 且 stage 非 done 且 status active。`week` 命令和 `apply` 共用这一个定义。

`today` 不落盘，只在日报里。

### 上层进度与评估

每个节点进度在 0 到 1，递归定义：

- 任何节点 stage 为 done 则进度为 1，不算缺口。
- task：done 1，review 0.5，其余 0；task 下挂了子任务时按 milestone 规则聚合。
- metric：`(value − from) / (to − from)`，clamp 到 0–1；无 value 为 0。
- milestone：已 done 为 1，否则子任务按 `weight` 加权均值。
- objective：子节点按 `weight` 加权均值。
- 无 active 子节点的非叶节点：`null`，不算缺口。均值中排除进度为 `null` 的子节点，tree 视图对该父节点标「N 个未拆解」。
- frozen / canceled 子树不参与推导、健康度和候选；子树内节点的事件类写入（log / done / block / claim / submit / reject / assess / check）默认拒绝（退出码 3，报「已冻结」或「已取消（自身或祖先）」），`--force` 放行。结构写（add / edit / move / rm）不受守卫，解冻本身就是 edit。

agent 的 `assess` 是覆盖：视图显示 assess 值，并记录当时的 `derived`。过期判定：assess 之后子树内出现 done / reject / submit / change 事件即过期。progress / claim / check 不触发。过期后视图并排显示「assess 值（N 天前）」和推导值，不替换。skill 每周评估一次，不再每次 done 都写。

### 健康度（推导，agent 改不了）

- 缺口只对 metric / milestone / objective 算：正常 / 有风险 / 落后由「进度 − 时间流逝」决定，只对有 `end` 的节点算。进度取值：assess 未过期用 assess 值，过期用推导值。
- task 不算缺口，只有标签：overdue（过 deadline 未 done）、due-soon（3 天内）、blocked、停滞（stage doing / blocked 且 7 天无事件）、待验收超 3 天。
- habit：本周期剩余天数不够补齐 cadence 即落后。
- 上层节点的停滞看整棵子树最近事件，14 天无事件。

## 3. CLI 命令

通用参数：`--json`（读写都支持，错误也以 JSON 输出到 stdout）、`--today`（只影响读，写命令传 `--today` 直接拒绝）、`--at <ts>`（写命令补记 `ts`，`rec` 仍为写入时间；`--at` 给日期时，今天取写入时刻、更早的一天取当天中午、更晚的一天拒绝；给完整时间时晚于写入时间超过 5 分钟拒绝）、`--demo`、`--by <agent>`（缺省 `OKR_BY`）、`--session <id>`、`--confirmed`、`--force`。时间戳统一要求本地时区显式数字偏移（如 `2026-09-03T21:00:00+08:00`），带 `Z` 或外地偏移的输入在写入前会被规整成本地偏移；不认识的 `--flag` 一律拒绝（退出码 1）。非 task 节点的 `--json` 输出省略 `stage` / `planned` / `carryOver` / `dispatchable` / `claimed` / `blocked` 这些只对 task 有意义的字段。

退出码：0 成功；1 一般错误；2 目标指代歧义（输出候选）；3 守卫拒绝或 validate 失败；4 锁超时。

结构：`init`、`add`（无法从 `--metric` / `--from` / `--to` 推出 metric、`--cadence` / `--habit` 推出 habit 时必须显式 `--kind`；单给 `--parent` 不再默认推成 task）、`edit`、`move`、`rm`（只允许无子节点、无 change 以外事件、无人依赖的节点，其余用 `edit --status canceled`；被删节点的 change 事件保留，validate 只提示不报错）、`tree`、`show <id> [--spec]`、`validate [--merge-events]`（`--merge-events` 在锁内合并并 commit；副本每行先 JSON 解析、`ts` / `rec` 规整成本地偏移，有坏行或并入后校验出新错误的副本原样保留不合、计入 errors）、`migrate`（旧 goals.yaml + events.jsonl 迁到新模型：done 状态转 done 事件，`scope` 并入 note 前缀，`rec` 取 `ts`，结束时写一条 daily report 事件作为初始锚点；先在内存里校验整体结果，不干净就整体不写，一条也不留；写入阶段失败则把旧文件改回原名；指向不存在 goal、时间戳无法解析、habit 上的 blocked 事件逐条跳过并计入 `warnings`，不中断迁移）、`repo add|rm|list <path>`、`protocol`（打印安装包内的 PROTOCOL.md，agent 不用知道仓库在哪）。纠错直接改，git 兜底。add / edit 里涉及 `deps` 的操作会跑成环检测，成环即拒绝并报出环路（如 `t1 → t2 → t1`）。add / edit 写入前校验整棵树，只拒绝本次写入新引入的错误；文件里已有的错误作为提示回显，留给 `okr validate` 处理。显式指定的 id 和自动生成的一样，不能复用事件历史或 deps 里出现过的 id。

记录：`log`、`done`、`block`、`claim`、`submit --link`、`reject`、`assess --value --reason`、`check`、`recent [--node] [--days]`。

计划数据：
- `week`：planned 任务按 `order` 排序，加上遗留任务并标明；`--json` 含 `proposal: none | pending | applied | dismissed`（比对 `reports/<week>*.plan.yaml` 与本周 plan 事件）。
- `brief`：到期、阻塞、停滞、待验收超时、已领取、待确认提案。
- `candidates [--dispatchable]`：可排任务及事实：截止、权重、缺口、依赖、遗留。
- `velocity`：近 4 周完成数；有用户口述 hours 时附用时。
- `commits [--since last-weekly]`：登记仓库的提交列表，agent 负责归纳。
- `changes --since last-daily|last-weekly|<ts>`：按 `rec` 过滤，包含 change 事件，排除 report 和 plan 事件。
- `apply --from <plan.yaml> --confirmed`：消费结构化提案；每个遗留任务必须出现在 `plan` 或 `drop` 里，否则退出码 3 并列出。同周多次 apply：`plan` 列表未提到的已计划任务保持原 `order`，列出的按列表顺序重排并接在末尾。`--dismiss` 否掉提案，写 dismissed 的 plan 事件。
- `report data --week`。

交付：`deliver notes`（AppleScript 写 macOS 备忘录，OKR 文件夹，一天一条；写 report 事件）、`report write`（存 reports/，写 report 事件）。每次 report 事件后做 `git bundle` 备份，见 §9。

视图：`tui`（看板、树、本周、事件）、`status`、`tree`、`week`、`show`。

### `show --spec` 输出

派工包，喂给执行 agent 的全部内容：spec 四项、node id、已领取者与时间、未完成的 deps、历史 submit 链接、每次 reject 的意见，以及可照抄的回写命令（`okr claim <id> --by <agent> --session <id>`、`okr block …`、`okr log …`、`okr submit <id> --link <PR>`）。

### `plan.yaml` 格式

```yaml
week: 2026-W36
new:                        # 新建任务，字段同节点；id 可选，缺省由 apply 生成
  - {id: kr1.3, parent: kr1, name: 特征 v3, priority: P1, deadline: 2026-09-05, spec: {...}}
  - {parent: kr1, name: 评测脚本, priority: P2}
plan: [t41, kr1.3, new:1]   # 本周全集，按优先顺序；new:N 引用 new 列表索引，0 起算；deps 里也可用
drop: [t39]                 # 遗留任务退出本周，清空 week
```

中途拆解（开工前、卡住时）落 `2026-W36.plan-2.yaml`、`plan-3.yaml`，不覆盖周报提案。

### 写入守卫

- `--session` 由执行 agent 自定任意字符串（如 worktree 名），claim 的 `--json` 回显。
- 所有写命令先取锁。Node 没有 `flock`，用独占创建（`O_EXCL`）的锁文件代替：`$TMPDIR/okr-<目录哈希>.lock`，内容为持有者 pid，不进 iCloud；持有者进程已死（`kill -0` 失败）则回收；锁文件为空或刚创建不足 2 秒（还在被写入）也视为可回收，回收用 rename 到当前 pid 专属后缀再删，避免并发回收者互相踩。每 50ms 重试，5 秒超时退出码 4。写命令在锁内重新读文件再校验再写，回调内部不 `process.exit`（改抛异常在锁外统一处理），保证锁一定在 finally 里释放。`nodes.yaml` 写临时文件再 rename；`events.jsonl` 单次 write 追加。
- 目标指代歧义：列候选，退出码 2，不猜。
- 去重：只与同一节点同一天同类型的上一条比较，内容相近则拒绝；`value` 或 `links` 不同、或中间有其他类型事件即豁免。`--force` 跳过。 `check` 例外：同一节点同一天已有 check 就拒绝，不看中间事件（补记打卡不能绕过）。
- assess 无理由：拒绝。assess 对 metric 带 value：拒绝。
- 结构变更（add / move / rm / apply）和 KR / objective / milestone 的 done：要 `--confirmed`。`--confirmed` 是协议不是防线，由 skill 在用户点头后传，记进事件供审计。
- submit 无 link：拒绝。submit 只对 task 有意义，非 task 拒绝。block 只对 task / milestone 有意义，其余节点拒绝。habit 没有 done，不再做就 `edit --status canceled`。reject 只放行「有 submit 或 stage 为 done」的节点，不限节点 kind（reopen 已完成的 KR / objective / milestone 需 `--confirmed`，见上文）。claim 一个 stage 为 done 的任务：拒绝。assess 同样要过冻结/取消守卫（同一节点同一天重复 assess 视为去重，`--force` 跳过）。
- git commit 失败：文件照常写入，stderr 警告，`--json` 返回 `committed: false`。
- claim 一个已被他人领取且未 submit 的任务：拒绝，除非 `--force`。「他人」按 `by + session` 识别，无 session 时按 `by`。
- apply 时 spec 不全：警告不拒绝；该任务不会出现在 `--dispatchable` 里。

## 4. Skill 职责

agent 无关的协议文档 `PROTOCOL.md`，仓库内 `skills/okr`（给对话 agent；执行 agent 侧暂无单独 skill，2026-09-04 移除；CLI 第一次运行时自动装进 `~/.agents/skills` 并随包更新，也可 `npx skills add`；不走 npm postinstall，npm 11 对带安装脚本的 git 全局包会装成指向临时 clone 的软链）和 `AGENTS.okr.md`（给不支持 skill 的 agent 的片段）共用：

- 写之前先 `okr recent`，语义查重是 skill 的事，CLI 只挡字面相近。
- 归属由 agent 判断，错了直接改。
- 上层进度默认信 CLI 推导；只在不同意时写 `assess`，理由引用具体任务和 KR 状态。周报时统一评估一次。
- 拆解时机：建目标、周计划、开工前、卡住时。拆解先展示提案，用户确认后落成 plan.yaml 再 `apply --confirmed`。当天步骤只在对话里，不落盘。
- 排序依据：截止和权重、落后最多、依赖、用户近期吞吐。今日清单从本周任务里挑，按顺序列完，每条一句为什么。排序算法在 skill，CLI 只给事实。
- 会话开始先 `okr brief`，有事才提一句；有待确认提案时提醒确认，用户否掉就 `apply --dismiss`。
- 仓库关联：`okr repo add` 登记路径，仓库里放 `.okr.yaml` 声明默认节点 id，方便在仓库里干活的 agent 知道往哪记。git 提取：CLI 列提交，agent 归纳。时机是完成大版本时调 skill 更新，或用户让 agent 汇总某个 repo 的进度。
- KR / objective / milestone 的完成要问用户。

## 5. 报告

日报（launchd 每天 11:00，含周末）：脚本先检查当天 daily report 事件是否已存在（睡醒补跑幂等），再 `okr changes --since last-daily` 与 `okr brief --json`。两者都为空才直接写「暂无更新」到备忘录，不叫 agent。否则 agent 写：待确认提案提示（若 pending）、今日顺序及理由、到期与阻塞、待验收与已领取、建议拆解（每天都有）、昨日进度。

周报（launchd 周一 10:00）：agent 写全文，一份分区块：上周回顾、各目标评估与周变化（树视图）、吞吐、本周提案（同时写 `plan.yaml`，等用户确认后 `apply --from`）、风险。存 `reports/`。图用文本块。

无头运行要求：安装时在终端手动跑一次 `deliver notes` 完成 osascript 自动化授权；plist 写死 node 与 claude 的绝对路径；脚本日志落 `OKR_DIR/logs/`。

## 6. 派工

先手动：用户点名任务，自己开 Herdr 窗格和 worktree，把 `okr show <id> --spec` 的派工包喂给执行 agent。执行 agent 只写四种事件：领取时 `claim`，卡住时 `block`，解除阻塞时 `log`，验证命令通过并提 PR 后 `submit --link`。用户验收通过 `done`，不通过 `reject` 带意见，同一任务继续，重派时派工包里带上打回意见。流程沉淀后再考虑封装成 `okr dispatch`。

## 7. 渲染层

derive → layout → paint。同一份 layout 三种输出：ANSI（TUI）、80 列纯文本（agent 贴进对话）、Markdown（报告）。视图：看板、树（带周变化）、燃起图、热力图、本周、吞吐、依赖链。排在开发顺序最后，日报周报闭环先跑通。

## 8. 开发顺序

1. 数据模型：树、任务字段与 spec、事件新字段与新类型、两维度推导、上层进度推导与 assess 覆盖、守卫与锁、退出码、edit / move / rm、validate、migrate、repo 登记、velocity。
2. `PROTOCOL.md` + 仓库内 `skills/okr`（CLI 首次运行自动装，也可 `npx skills add`；CLI 和 skill 一起并入 Wayne-Skills 仓库，取代旧的 okr skill）+ AGENTS.md 片段。
3. 计划数据命令：week / brief / candidates / velocity / commits / changes / apply / report data，plan.yaml 格式。
4. 定时任务：launchd 日报（deliver notes）与周报，幂等与授权步骤。
5. TUI：树看板、本周页、报告页；渲染层三种输出。

## 9. iCloud 缓解

`.git` 留在 iCloud 是既定决定。低成本保护：

- 锁不进 iCloud（见守卫）。
- 数据目录 `.gitignore` 排除 `* [0-9].*` 冲突副本和 `logs/`，不进 git 历史。
- `validate` 检查 `*.icloud` 占位文件、冲突副本，跑 `git fsck --no-dangling`，并要求 `git status --porcelain` 为空（发现静默失败的 commit），任一失败退出码 3。`validate --merge-events` 把 `events 2.jsonl` 按 (ts, node, type, note) 去重并入主文件；`nodes.yaml` 冲突只报不合。
- 每次 report 事件后 `git bundle create` 到 iCloud 之外（`~/Library/Application Support/okr/`），`.git` 坏了还有一份历史。
- 可选、默认不开：`.git` 改成文件指向同目录 `git.nosync/`，iCloud 跳过 `.nosync` 目录。用户明确不要时不启用。
