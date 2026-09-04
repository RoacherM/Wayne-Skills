# Wayne Skills

给 coding agent 用的 skill 集合，外加它们依赖的命令行工具。一个仓库，`skills/<name>/SKILL.md` 每个目录一个 skill，用 [`npx skills add`](https://github.com/vercel-labs/skills) 装给 Claude Code / Codex / Copilot / OpenCode / Gemini。

| skill | 做什么 | 依赖 |
|---|---|---|
| `deep-think` | `/deep-think design|review <topic>`：用 OpenRouter 上的 GPT-5.x 做第一性原理的架构推演，Why → What → How → Quality → Proof 五层 | `OPENROUTER_API_KEY`、curl、jq |
| `okr` | 替用户记目标 / KR / 任务 / 习惯的进展，看板、评估、拆解、周计划、派工 | `okr` CLI（本仓库） |
| `okr-executor` | 执行 agent 拿到 okr 派工包后只回写 claim / block / log / submit | `okr` CLI（本仓库） |

## 安装

```bash
npx -y skills add RoacherM/Wayne-Skills -s '*' -g -y -a claude-code -a codex   # 全部 skill
npx -y skills add RoacherM/Wayne-Skills -s okr -s okr-executor -g -y -a codex  # 只要某几个；-l 只列不装
npm install -g github:RoacherM/Wayne-Skills                                     # okr CLI（Node ≥ 23.6，无构建步骤）
```

skill 装到 `~/.agents/skills/<name>`：Codex / Copilot / OpenCode 直接读这个目录，Claude Code 由 `~/.claude/skills/<name>` 软链过去；要 Gemini 就加 `-a gemini-cli`。更新：skill 跑 `npx -y skills update`，CLI 重跑 `npm install -g`。

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
git clone https://github.com/RoacherM/Wayne-Skills ~/Desktop/Devs/wayne-skills && cd ~/Desktop/Devs/wayne-skills
npm install && npm link                          # okr 指向仓库，改代码即生效
npm test && npm run typecheck
npx -y skills add ~/Desktop/Devs/wayne-skills -s '*' -g -y -a claude-code -a codex
for s in ~/Desktop/Devs/wayne-skills/skills/*/; do n=$(basename $s); rm -rf ~/.agents/skills/$n && ln -s $s ~/.agents/skills/$n; done   # 换成软链，改 SKILL.md 即生效
```

加新 skill 看 [`skills/README.md`](skills/README.md)。

## License

MIT
