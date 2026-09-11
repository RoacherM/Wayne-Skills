# Wayne Skills

给 coding agent 用的 skill 集合，外加它们依赖的命令行工具。一个仓库，`skills/<name>/SKILL.md` 每个目录一个 skill，用 [`npx skills add`](https://github.com/vercel-labs/skills) 装给 Claude Code / Codex / Copilot / OpenCode / Gemini。

| skill | 做什么 | 依赖 |
|---|---|---|
| `okr` | 替用户记目标 / KR / 任务 / 习惯的进展，看板、评估、拆解、周计划、派工 | `okr` CLI（本仓库） |
| `terminal-diagrams` | 用户在终端里读回复时，agent 不发 ```mermaid 源码，而是用 `mmd2txt` 渲染成框线字符图再贴 | [`mmd2txt`](https://github.com/RoacherM/mmd2txt)，`npm install -g github:RoacherM/mmd2txt` |
| `sw-*`、`chekhov-dramaturgy`、`ozu-screenplay-style` | 13 个编剧 skill：流程调度、结构、前提、人物、对白、场景、格式改编、美日韩法案例、行业、契诃夫、小津。复制自 [jtydhr88/screenwriting-skills](https://github.com/jtydhr88/screenwriting-skills) v1.3.0，清单见 [`skills/README.md`](skills/README.md) | 无 |

## 安装

skill 自带打包好的 CLI（`skills/okr/scripts/okr.js`，单文件纯 JS，Node ≥ 20），用 [skills CLI](https://github.com/vercel-labs/skills) 装，`-a` 选自己用的 agent：

```bash
npx -y --no-audit skills add RoacherM/Wayne-Skills -s okr -g -y -a claude-code -a codex   # -a 可多个：gemini-cli、cursor、opencode…；不带 -a 进交互选择
npx -y --no-audit skills update -g                                                          # 更新
```

装完 agent 直接跑 `node ~/.agents/skills/okr/scripts/okr.js …`（SKILL.md 里写了）。终端里想直接敲 `okr`：

```bash
node ~/.agents/skills/okr/scripts/okr.js skill link   # 软链到 ~/.local/bin/okr；--dir 换目录
```

另一条路，先要命令再要 skill：`npm install -g github:RoacherM/Wayne-Skills` 把 `okr` 放到 PATH 上，第一次运行时把 skill 复制到 `~/.agents/skills/okr` 并给 Claude Code 建软链 `~/.claude/skills/okr`（只装这两处；之后随包自动更新自己装的那份，`OKR_SKIP_SKILL=1` 关掉；`okr skill install | remove | status` 手动）。不用 npm postinstall 是因为 npm 11 会把带安装脚本的 git 全局包装成指向临时 clone 的软链。`--no-audit`：首次拉包时 npm 的 audit 请求在某些网络下会静默挂几分钟。

### 编剧 skill（只装在本仓库）

13 个编剧 skill 不走插件，也不装到全局，只用 npx 以项目级复制装进本仓库：在本仓库里打开的 Claude Code 读 `.claude/skills/`，Codex 读 `.agents/skills/`。两份拷贝和 `skills-lock.json` 都提交在仓库里，clone 下来就能用。改了 `skills/` 下的编剧 skill 后，在仓库根目录重跑：

```bash
npx -y --no-audit skills add ./ -y -a claude-code -a codex --copy \
  -s sw-workflow -s sw-story-structure -s sw-premise-theme -s sw-character-conflict -s sw-dialogue -s sw-scene-craft \
  -s sw-format-adaptation -s sw-american-case-studies -s sw-japanese-screenwriting -s sw-korean-french-screenwriting \
  -s sw-industry-business -s chekhov-dramaturgy -s ozu-screenplay-style
```

## 全局 AGENTS.md

`global/AGENTS.md` 是给所有 coding agent 的全局指令，一份文件，换机器时 clone 仓库后跑一次就同步：

```bash
bash global/link.sh            # 软链到 ~/.claude/CLAUDE.md、~/.codex/AGENTS.md、~/.config/opencode/AGENTS.md、~/.pi/agent/AGENTS.md；原有文件留作 .bak-日期
bash global/link.sh --remove   # 只删指向本文件的软链
```

写法按 Anthropic 的 Fable 5.1 提示指南和 OpenAI 的 GPT-6 Astra 模型指南：两代模型都会严格照做，所以只写 harness 没说的事（回复语言、改动范围、密钥、终端画图、git 边界），不重复系统提示里已有的段落，不写互相矛盾的规则。Claude Code 自带的 Fable 5.1 提示块已覆盖进度汇报、并行调用、完成整个任务、交付范围、排版密度，这些不再写。

## okr

目标与任务追踪，终端里看，agent 也能读写。事件进，视图出。用法见 [`docs/okr/README.md`](docs/okr/README.md)，设计见 [`docs/okr/DESIGN.md`](docs/okr/DESIGN.md)，agent 读写规则见 [`docs/okr/PROTOCOL.md`](docs/okr/PROTOCOL.md)（装好后 `okr protocol` 直接打印）。

```bash
okr init && okr         # 初始化 ~/.okr，打开 TUI
okr status              # 看板（管道里是纯文本，--md 出 markdown）
okr week                # 本周计划 / 遗留 / 吞吐
okr brief               # 今天该注意什么
okr log kr1 "基线跑完" --value 80
okr show kr1.2 --spec   # 派工包
```

## 本地开发

```bash
git clone https://github.com/RoacherM/Wayne-Skills ~/Desktop/Projects/sides/wayne-skills && cd ~/Desktop/Projects/sides/wayne-skills
npm install && npm link                          # okr 指向仓库源码（跑源码要 Node ≥ 23.6），改代码即生效；会覆盖 npm install -g 装的那份，回发布版重跑 npm install -g
npm run bundle                                    # 改了 src/ 或 PROTOCOL.md 后重新打包 skills/okr/scripts/okr.js，测试会检查它没过期
npm test && npm run typecheck
for s in ~/Desktop/Projects/sides/wayne-skills/skills/*/; do n=$(basename $s); rm -rf ~/.agents/skills/$n && ln -s $s ~/.agents/skills/$n; done   # skill 用软链，改 SKILL.md 即生效
okr skill install                                # 只补 Claude Code 的软链；~/.agents/skills 里已是软链就不动，自动安装也不碰软链
```

加新 skill 看 [`skills/README.md`](skills/README.md)。

## License

MIT
