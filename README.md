# Wayne Skills

给 coding agent 用的 skill 集合，外加它们依赖的命令行工具。一个仓库，`skills/<name>/SKILL.md` 每个目录一个 skill，用本仓库的 `bin/wayne-skills.js` 装给本机的 Claude Code / Codex / Pi / Grok / Antigravity。

| skill | 做什么 | 依赖 |
|---|---|---|
| `okr` | 替用户记目标 / KR / 任务 / 习惯的进展，看板、评估、拆解、周计划、派工 | `okr` CLI（本仓库） |
| `terminal-diagrams` | 用户在终端里读回复时，agent 不发 ```mermaid 源码，而是用 `mmd2txt` 渲染成框线字符图再贴 | [`mmd2txt`](https://github.com/RoacherM/mmd2txt)，`npm install -g github:RoacherM/mmd2txt` |
| `git-story-film` | 给一个 GitHub 仓库，按 Git 历史里真实的提交、版本、回滚编故事，做成约两分钟的手绘动画短片（大纲→角色→分镜→浏览器 Studio 预览→4K/60fps MP4）。复制自 [EverMind-AI/Raven](https://github.com/EverMind-AI/Raven/tree/main/skills/git-story-film)，Apache-2.0 | Node 22+、Google Chrome、ffmpeg、Python 3.8+ |
| `sw-*`、`chekhov-dramaturgy`、`ozu-screenplay-style` | 13 个编剧 skill：流程调度、结构、前提、人物、对白、场景、格式改编、美日韩法案例、行业、契诃夫、小津。复制自 [jtydhr88/screenwriting-skills](https://github.com/jtydhr88/screenwriting-skills) v1.3.0，清单见 [`skills/README.md`](skills/README.md) | 无 |

## 安装

所有全局 skill（本仓库的和别人仓库的）都用 `bin/wayne-skills.js` 装。它调 [skills CLI](https://github.com/vercel-labs/skills)，但只给本机装了的 agent 建链接：

| agent | 读哪里 | 安装器做什么 |
|---|---|---|
| Codex、Pi、Grok | `~/.agents/skills`（Pi、Grok 另外也读自己的目录） | 什么都不用，skills CLI 总会把正本写在这里 |
| Claude Code | `~/.claude/skills` | 有 `~/.claude` 才传 `-a claude-code`，由 skills CLI 建软链 |
| Antigravity | `~/.gemini/config/skills`（skills CLI 以为它读 `~/.agents/skills`，不对） | 有 `~/.gemini/antigravity` 才由安装器自己建软链 |

```bash
W=~/Desktop/Projects/sides/wayne-skills/bin/wayne-skills.js
node $W add RoacherM/Wayne-Skills -s okr -s git-story-film   # 装别人的就换 source：owner/repo 或 URL
node $W update                                             # 按 ~/.agents/.skill-lock.json 全部重装；也可只写几个 skill 名
node $W remove git-story-film
```

不要直接跑 `npx skills add` 不带 `-a`，也不要跑 `npx skills update -g`：这两种情况下 skills CLI 会把 skill 装给所有「home 下有目录」的 agent，并给每个 agent 新建 `skills` 目录，下次更新又把这些目录当成已安装的 agent，目录越积越多（2026-09-29 清掉过 52 个）。`update` 跳过 `~/.agents/skills` 里是软链的 skill（如 ego-browser，由它自己的安装器管）。

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
bash global/link.sh            # 拷到 ~/.agents/AGENTS.md，再软链到 ~/.claude/CLAUDE.md、~/.codex/AGENTS.md、~/.pi/agent/AGENTS.md；原有文件留作 .bak-日期；corrections/README.md 拷到 ~/.agents/corrections/
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
