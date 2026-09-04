# Wayne Skills

给 coding agent 用的 skill 集合，外加它们依赖的命令行工具。一个仓库，`skills/<name>/SKILL.md` 每个目录一个 skill，用 [`npx skills add`](https://github.com/vercel-labs/skills) 装给 Claude Code / Codex / Copilot / OpenCode / Gemini。

| skill | 做什么 | 依赖 |
|---|---|---|
| `okr` | 替用户记目标 / KR / 任务 / 习惯的进展，看板、评估、拆解、周计划、派工 | `okr` CLI（本仓库） |

## 安装

一条命令，CLI 和 skill 一起装（Node ≥ 23.6，无构建步骤）：

```bash
npm install -g github:RoacherM/Wayne-Skills
```

第一次运行任意 `okr` 命令时，CLI 把自带的 `okr` skill 复制到 `~/.agents/skills/okr`（Codex / Copilot / OpenCode 直接读这个目录），并给 Claude Code 建软链 `~/.claude/skills/okr`，stderr 提示一行。更新就重跑同一条命令，下次运行 `okr` 时自动把这份拷贝换成新版（只动自己装的那份：`~/.agents/skills/okr` 是软链或没有 `.wayne-skills` 戳记就不碰）。手动：`okr skill install`（`--force` 覆盖开发用的软链）、`okr skill remove`、`okr skill status`；`OKR_SKIP_SKILL=1` 关掉自动安装。之所以不用 npm 的 postinstall：npm 11 遇到带安装脚本的 git 包，会把全局安装做成指向临时 clone 的软链，装完即失效。

也可以用 [skills CLI](https://github.com/vercel-labs/skills) 装 skill（比如要 Gemini：`npx -y --no-audit skills add RoacherM/Wayne-Skills -s okr -g -y -a gemini-cli`；`--no-audit` 是因为首次拉包时 npm 的 audit 请求在某些网络下会静默挂几分钟）。两种方式装到同一个位置，后装的覆盖先装的。

## okr

目标与任务追踪，终端里看，agent 也能读写。事件进，视图出。用法见 [`docs/okr/README.md`](docs/okr/README.md)，设计见 [`docs/okr/DESIGN.md`](docs/okr/DESIGN.md)，agent 读写规则见 [`docs/okr/PROTOCOL.md`](docs/okr/PROTOCOL.md)（装好后 `okr protocol` 直接打印）。

```bash
okr tui --demo          # 先用示例数据看看
okr status              # 看板
okr log kr1 "基线跑完" --value 80
okr show kr1.2 --spec   # 派工包
```

## 本地开发

```bash
git clone https://github.com/RoacherM/Wayne-Skills ~/Desktop/Projects/sides/wayne-skills && cd ~/Desktop/Projects/sides/wayne-skills
npm install && npm link                          # okr 指向仓库，改代码即生效；会覆盖 npm install -g 装的那份，回发布版重跑 npm install -g
npm test && npm run typecheck
for s in ~/Desktop/Projects/sides/wayne-skills/skills/*/; do n=$(basename $s); rm -rf ~/.agents/skills/$n && ln -s $s ~/.agents/skills/$n; done   # skill 用软链，改 SKILL.md 即生效
okr skill install                                # 只补 Claude Code 的软链；~/.agents/skills 里已是软链就不动，自动安装也不碰软链
```

加新 skill 看 [`skills/README.md`](skills/README.md)。

## License

MIT
