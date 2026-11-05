# Wayne Skills

我的全局 skill 清单和我自己写的 skill。本机 `~/.agents/skills` 里装什么，只由 [`global/skills.json`](global/skills.json) 决定；`bin/wayne-skills.js sync` 让本机和清单一致，并给 Claude Code / Codex / Pi / Grok / Antigravity 建链接。

## 本仓库的 skill

| skill | 做什么 | 依赖 |
|---|---|---|
| `terminal-diagrams` | 用户在终端里读回复时，agent 不发 ```mermaid 源码，而是用 `mmd2txt` 渲染成框线字符图再贴 | [`mmd2txt`](https://github.com/RoacherM/mmd2txt)，`npm install -g github:RoacherM/mmd2txt` |
| `ub-mode` | 写代码、改代码、审代码时用三件外部量具打分：crapper（复杂度×覆盖率，CRAP < 10）、dryer（结构重复）、mutator（变异测试）。工具是 Uncle Bob 的 [crapper](https://github.com/unclebob/crapper) / [dryer](https://github.com/unclebob/dryer) / [mutator](https://github.com/unclebob/mutator)（0BSD），源码内置在 `skills/ub-mode/tools/`，`scripts/ub` 首次运行用 uv 在 `~/.cache/ub-mode` 建一个共用环境 | [uv](https://docs.astral.sh/uv/)、Python 3.11–3.14（uv 会自己下载） |
| `deslop` | 给已有文本去 AI 味：删空话、模板句、翻译腔，理顺主语、术语和段落，保留原意和事实 | 无 |
| `herdr` | 在 Herdr.app 里用同 Tab 分屏（`herdr-app` + `hc`）跑开发模式和测试模式：先立假设、穿透单一绿灯、证据先行、保护注意力 | Herdr.app（`herdr-app`、`hc`） |

## 全局 skill 清单

`global/skills.json` 列出本机全部全局 skill，分三类：

| 类别 | `~/.agents/skills/<name>` 是什么 | 怎么更新 | 现在有 |
|---|---|---|---|
| `links` | 软链到本地仓库（相对路径指本仓库，`~/` 指 home） | 改仓库就生效 | 本仓库 4 个、storyforge |
| `remote` | skills CLI 从 GitHub / 网站拷来的副本 | `update` | skill-creator、find-skills、show-me、lark-doc、lark-shared |
| `external` | 别的工具自己装的（值写着装法） | 那个工具自己管 | rex、wayne-herdr-mods |

```bash
W=~/Projects/sides/wayne-skills/bin/wayne-skills.js
node $W sync            # 装齐清单里缺的，给本机有的 agent 建链接；可以反复跑
node $W sync --prune    # 同上，再把清单外的 skill 移到 ~/.agents/backup/sync-<时间>/
node $W update          # 重新拉 remote 类 skill；也可只写几个名字
```

增删全局 skill：改 `global/skills.json`，跑 `sync --prune`，再提交。换机器：clone 本仓库到 `~/Projects/sides/wayne-skills`，跑 `sync`。

各 agent 读哪里：

| agent | 读哪里 | sync 做什么 |
|---|---|---|
| Codex、Pi、Grok | `~/.agents/skills` | 什么都不用 |
| Claude Code | `~/.claude/skills` | 有 `~/.claude` 才建软链 |
| Antigravity | `~/.gemini/config/skills` | 有 `~/.gemini/antigravity` 才建软链 |

不要直接跑 `npx skills add` 不带 `-a`，也不要跑 `npx skills update -g`：这两种情况下 skills CLI 会把 skill 装给所有「home 下有目录」的 agent，并给每个 agent 新建 `skills` 目录，下次更新又把这些目录当成已安装的 agent，目录越积越多（2026-09-29 清掉过 52 个）。安装器只传 `-a codex`（只写 `~/.agents/skills` 那一份），链接自己建。

## 全局 AGENTS.md

`global/AGENTS.md` 是给所有 coding agent 的全局指令，一份文件，换机器时 clone 仓库后跑一次就同步：

```bash
bash global/link.sh            # 拷到 ~/.agents/AGENTS.md，再软链到 ~/.claude/CLAUDE.md、~/.codex/AGENTS.md、~/.pi/agent/AGENTS.md；原有文件留作 .bak-日期；corrections/README.md 拷到 ~/.agents/corrections/
bash global/link.sh --remove   # 只删指向本文件的软链
```

写法按 Anthropic 的 Fable 5.1 提示指南和 OpenAI 的 GPT-6 Astra 模型指南：两代模型都会严格照做，所以只写 harness 没说的事（回复语言、改动范围、密钥、终端画图、git 边界），不重复系统提示里已有的段落，不写互相矛盾的规则。Claude Code 自带的 Fable 5.1 提示块已覆盖进度汇报、并行调用、完成整个任务、交付范围、排版密度，这些不再写。

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

## 本地开发

```bash
git clone https://github.com/RoacherM/Wayne-Skills ~/Projects/sides/wayne-skills && cd ~/Projects/sides/wayne-skills
node bin/wayne-skills.js sync                     # 本仓库的 skill 软链进 ~/.agents/skills，改 SKILL.md 即生效
npm test                                          # 安装器测试，无依赖
```

加新 skill：建 `skills/<name>/SKILL.md`（可带 `evals/evals.json`），在 `global/skills.json` 的 `links` 里加一行，跑 `sync`。

## License

MIT
