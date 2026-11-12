# Wayne Skills

我的全局 skill 清单和我自己写的 skill。本机 `~/.agents/skills` 里装什么，只由 [`global/skills.json`](global/skills.json) 决定；`bin/wayne-skills.js sync` 让本机和清单一致，并给 Claude Code / Codex / Pi / Epi / Factory Droid / Grok / Antigravity 准备链接。

## 本仓库的 skill

| skill | 做什么 | 依赖 |
|---|---|---|
| `terminal-diagrams` | 用户在终端里读回复时，agent 不发 ```mermaid 源码，而是用 `mmd2txt` 渲染成框线字符图再贴 | [`mmd2txt`](https://github.com/RoacherM/mmd2txt)，`npm install -g github:RoacherM/mmd2txt` |
| `ub-mode` | 写代码、改代码时用三件外部量具打分：crapper（复杂度×覆盖率，CRAP < 10）、dryer（结构重复）、mutator（变异测试）。工具是 Uncle Bob 的 [crapper](https://github.com/unclebob/crapper) / [dryer](https://github.com/unclebob/dryer) / [mutator](https://github.com/unclebob/mutator)（0BSD），源码内置在 `skills/ub-mode/tools/`，`scripts/ub` 首次运行用 uv 在 `~/.cache/ub-mode` 建一个共用环境 | [uv](https://docs.astral.sh/uv/)、Python 3.11–3.14（uv 会自己下载） |
| `herdr` | 在 Herdr 里控制分屏、终端和 Agent。先判断环境：Herdr.app（`herdr-app` + `hc`）走 `references/herdr-app.md` 里的分屏开发流程（日常左 1 + 右 2，按需加开 Reviewer）；终端版 `herdr` 走 `herdr --skill` 的官方说明 | Herdr.app 或 herdr |
| `implicit-state-machines` | 原样一句提示词：找出应用里所有隐式状态机，选同时提升 UX、DX、AX 且不破坏现有功能的方案 | 无 |
| `deslop` | 给已有中文文本去 AI 味：删空话、模板句、翻译腔，理顺主语、术语和段落，保留原意和事实 | 无 |
| `unslop-ui` | 把「一看就是 AI 生成」的界面改成有自己性格的设计：先审出 slop，定方向，再按间距、颜色、图标、文案、字体、布局、细节、画面、动效九遍改。可拍网页快照、可出 10 秒 story 视频。本地加了一份审美参考 `references/recent.md`（[recent.design](https://recent.design) 精选作品的共同做法）和拉取最新精选的 `scripts/recent.mjs`。原作者 [Damir Sokolovsky](https://github.com/heydamir/unslop)，CC BY 4.0 | 无；快照和视频要 Playwright + Chromium，视频还要 ffmpeg |
| `vibe-coding` | 通用编码与项目工程规范：代码品味（按概念拆文件、无 boolean 开关、信任边界校验、删旧路径）、两级验证（`oxlint` / `ruff` / `shellcheck` 毫秒级静态快检 + `ub-mode` 结构与变异门禁）、目录边界（`code / test / dev / probe / bench`）、极简仓库 `AGENTS.md` 模板、活文档与接口设计（OpenAPI + Cloudflare Nimbus）、统一评审规则与评审执行器（`scripts/review.sh` + 门禁钩子）、以及 Issue 自动修复 5 步闭环（附 `scripts/doc-lint.mjs`） | Node.js ≥ 20；`npm i -g oxlint`、`uv tool install ruff`、`brew install shellcheck` |
| `nowledge-mem` | 用 `nmem` 命令行读写 Nowledge Mem：开工读上下文、搜记忆和对话、存结论；后台 LaunchAgent 每 10 分钟同步 6 个 coding agent 的对话 | Nowledge Mem Desktop（自带 `nmem`）；没有 Desktop 的机器由 `global/nowledge/apply.sh` 用 uv 装 `nmem-cli` 0.10.112 |

## 全局 skill 清单

`global/skills.json` 列出本机全部全局 skill，分三类（另支持可选 `files` 拉取外部支撑目录）：

| 类别 | `~/.agents/skills/<name>` 是什么 | 怎么更新 | 现在有 |
|---|---|---|---|
| `links` | 软链到本地仓库（相对路径指本仓库，`~/` 指 home） | 改仓库就生效 | 本仓库 8 个、storyforge |
| `remote` | skills CLI 从 GitHub / 网站拷来的副本 | `update` | skill-creator、auday、lark-doc、lark-shared、[NSH](https://nsh.dev) 官方的 nsh 和 nsh-design-guides（开发指南与设计规范，来自 [longbridge/nsh](https://github.com/longbridge/nsh/tree/main/skills)）、[pstack](https://github.com/cursor/plugins/tree/main/pstack) 里的 bro |
| `external` | 别的工具自己装的（值写着装法） | 那个工具自己管 | colab-operator、ego-browser、wayne-herdr-mods |

```bash
W=~/Projects/sides/wayne-skills/bin/wayne-skills.js
node $W sync            # 装齐清单里缺的，给本机有的 agent 建链接；可以反复跑
node $W sync --prune    # 同上，再列出清单外的 skill（只列，不动）
node $W sync --prune --yes   # 真的把清单外的 skill 移到 ~/.agents/backup/sync-<时间>/
node $W update          # 重新拉 remote 类 skill；也可只写几个名字
```

增删全局 skill：改 `global/skills.json`，跑 `sync --prune` 看清单外有什么，确认后加 `--yes`，再提交。别的工具（如 `colab`）自己装的 skill 也会出现在清单外：要留就写进 `external`。换机器：clone 本仓库到 `~/Projects/sides/wayne-skills`，跑 `sync`。

各 agent 读哪里：

| agent | 读哪里 | sync 做什么 |
|---|---|---|
| Codex、Pi、Epi、Factory Droid | `~/.agents/skills` | 什么都不用 |
| Claude Code | `~/.claude/skills` | 有 `~/.claude` 才建软链 |
| Grok | `~/.grok/skills` | 有 `~/.grok` 才建软链 |
| Antigravity | `~/.gemini/config/skills` | 有 `~/.gemini/antigravity` 才建软链 |

不要直接跑 `npx skills add` 不带 `-a`，也不要跑 `npx skills update -g`：这两种情况下 skills CLI 会把 skill 装给所有「home 下有目录」的 agent，并给每个 agent 新建 `skills` 目录，下次更新又把这些目录当成已安装的 agent，目录越积越多（2026-09-29 清掉过 52 个）。安装器只传 `-a codex`（只写 `~/.agents/skills` 那一份），链接自己建。

## 全局 AGENTS.md 与 MEMORY.md

全局规则做两层拆分，换机器 clone 仓库后跑一次 `link.sh` 即可同步：
- [`global/AGENTS.md`](global/AGENTS.md)（常驻所有会话）：只写 5 条跨任务通用原则（先想清楚再动手、极简优先、精准边界与模块长期归属、目标驱动与长任务播报、按场景索引个人偏好），不耦合任何具体 Skill 名字。
- [`global/MEMORY.md`](global/MEMORY.md)（拷到 `~/.agents/MEMORY.md`，按需读取）：按 `界面与原型 / 编码与验证 / 文档与沟通 / 环境与配额` 四节沉淀个人工作习惯与跨项目历史纠偏记录，避免常驻规则越积越重。

```bash
bash global/link.sh            # 拷 AGENTS.md / MEMORY.md 到 ~/.agents/，软链到 ~/.claude/CLAUDE.md、~/.codex/AGENTS.md、~/.pi/agent/AGENTS.md、~/.factory/AGENTS.md、~/.grok/AGENTS.md、~/.gemini/GEMINI.md；corrections/README.md 拷到 ~/.agents/corrections/
bash global/link.sh --remove   # 清理上述副本与指向 AGENTS.md 的软链（.bak 备份不动）
```

## Claude Code 设置

`global/claude/` 只放自己改过的 Claude Code 设置，换机器后跑一次就同步：

| 文件 | 内容 |
|---|---|
| `settings.json` | 自动 compact 窗口 400k；关遥测、错误上报、`/bug`、非必要流量；状态栏；跳过危险模式确认；启动时不开远程控制 |
| `statusline.sh` | 状态栏：模型 · 目录 · git · 上下文占比 · 5h/7d 限额和重置倒计时，依赖 `jq` |

```bash
bash global/claude/apply.sh            # 把 settings.json 合并进 ~/.claude/settings.json（原文件留作 .bak-时间），再拷 statusline.sh；重启 Claude Code 生效
bash global/claude/apply.sh --check    # 只看哪些键不同，不改文件
```

合并只覆盖仓库里列出的键，`env` 里的其他变量保留。模型列表、`ANTHROPIC_*`、`CLAUDE_CODE_MODEL_CAPABILITIES`、`model`、`effortLevel` 由 magpie 写，herdr 的 `SessionStart` 钩子由 herdr 写，都不放进仓库。在本机改了这几项后，同步改仓库里的 `settings.json` 再提交。

## Nowledge Mem

长期记忆统一走 `nowledge-mem` skill 和 `nmem` 命令行，不再用 Nowledge Mem 官方给每个工具各装一个的插件——不要装它们，会和这里的 skill、后台同步重复。

```bash
node bin/wayne-skills.js sync        # skill 软链进 ~/.agents/skills，各 agent 按 description 自动触发
bash global/nowledge/apply.sh        # 确认 nmem 可用，装 LaunchAgent：每 10 分钟同步 6 个 agent 的对话
bash global/nowledge/apply.sh --check    # 只看状态：nmem、doctor、plist、job、日志最后 5 行
bash global/nowledge/apply.sh --remove   # 卸载 LaunchAgent（日志保留）
```

同步日志在 `~/Library/Logs/nmem-capture.log`。换机器时在 `sync` 之后跑一次 `apply.sh` 就齐了。历史对话全量回填是一次性手动操作：`nmem t sync --from <工具名> --all-projects --apply`（不带 `--limit`）。

## 本地开发

```bash
git clone https://github.com/RoacherM/Wayne-Skills ~/Projects/sides/wayne-skills && cd ~/Projects/sides/wayne-skills
node bin/wayne-skills.js sync                     # 本仓库的 skill 软链进 ~/.agents/skills，改 SKILL.md 即生效
npm test                                          # 安装器、Nowledge、doc-lint 与统一评审脚本测试，无外部依赖
```

加新 skill：建 `skills/<name>/SKILL.md`（可带 `evals/evals.json`），在 `global/skills.json` 的 `links` 里加一行，跑 `sync`。

## License

MIT
