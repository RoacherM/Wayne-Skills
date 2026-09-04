# skills

每个子目录一个 skill，`SKILL.md` 是入口，`evals/evals.json` 是触发与行为用例。装法：`npx -y --no-audit skills add RoacherM/Wayne-Skills -s <name> -g -y -a <agent>`（`-l` 只列不装，不带 `-s` 会进交互多选）。`okr` skill 自带打包好的 CLI `scripts/okr.js`（`npm run bundle` 从 `src/` 打出来）；`npm install -g github:RoacherM/Wayne-Skills` 是另一条路，CLI 第一次运行时把 `okr` 装进 `~/.agents/skills`（见 `src/skill.ts` 的 `ensureSkill`；不用 npm postinstall，npm 11 对带安装脚本的 git 全局包有 bug）。

| skill | 给谁 | 做什么 |
|---|---|---|
| `okr` | 用户的日常对话 agent | 记进展、看板、评估、拆解、周计划、结构变更、派工（协议 §2–§8） |

okr skill 的规则都在 `docs/okr/PROTOCOL.md`，skill 只负责把协议接进对话：先 `okr protocol` 读它，再动手。skill 里只写「本 skill 固定的事」和「意图 → 协议章节」，不复制协议内容。

## 加一个 skill

1. `mkdir skills/<name>`，写 `SKILL.md`：frontmatter 只要 `name`（同目录名）和 `description`（触发条件写全，中英文关键词都放进去，agent 靠它决定要不要加载）。
2. 正文只写这个 skill 的固定规则和回复格式；依赖某个 CLI 或长文档的，第一段给出读取命令（照抄 okr skill 的写法），不把文档复制进 SKILL.md。
3. `evals/evals.json` 放 3–12 条 `{ id, prompt, expected_output }`，覆盖触发、常见路径和守卫被拒。
4. 在上表加一行；要让 CLI 自动装它的话，把它加进 `package.json` 的 `files` 和 `src/skill.ts`（目前只装 okr）。
5. 本地开发把它软链进 `~/.agents/skills/<name>`（见根 README「本地开发」），Claude Code 再软链 `~/.claude/skills/<name> -> ../../.agents/skills/<name>`。
