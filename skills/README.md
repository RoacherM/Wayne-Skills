# skills

每个子目录一个 skill，`SKILL.md` 是入口，`evals/evals.json` 是触发与行为用例。装法：`npx -y --no-audit skills add RoacherM/Wayne-Skills -s <name> -g -y -a <agent>`（`-l` 只列不装，不带 `-s` 会进交互多选）。`okr` skill 自带打包好的 CLI `scripts/okr.js`（`npm run bundle` 从 `src/` 打出来）；`npm install -g github:RoacherM/Wayne-Skills` 是另一条路，CLI 第一次运行时把 `okr` 装进 `~/.agents/skills`（见 `src/skill.ts` 的 `ensureSkill`；不用 npm postinstall，npm 11 对带安装脚本的 git 全局包有 bug）。

| skill | 给谁 | 做什么 |
|---|---|---|
| `okr` | 用户的日常对话 agent | 记进展、看板、评估、拆解、周计划、结构变更、派工（协议 §2–§8） |
| `terminal-diagrams` | 任何在终端里回复的 agent（Claude Code / Codex / opencode…） | 画图时不发 ```mermaid，用 PATH 上的 `mmd2txt`（独立仓库 RoacherM/mmd2txt，`npm install -g github:RoacherM/mmd2txt`）渲染成 ```text 框线图；`scripts/mmd-guard.js` 是 Claude Code / Codex 的 Stop hook 兜底；`scripts/setup.js` 检查命令并注册 hook |

以下 13 个来自 [jtydhr88/screenwriting-skills](https://github.com/jtydhr88/screenwriting-skills)（plugin `screenwriting` v1.3.0，复制自 2026-09-08 的 commit `0657714`），由 19 本编剧书与契诃夫、小津全集蒸馏而成，正文中文、frontmatter 英文。上游许可为「For personal study use」，未附 evals。不用上游的插件装法，只以项目级复制装进本仓库的 `.claude/skills/` 和 `.agents/skills/`（命令见根 README）。与上游唯一的差别：`sw-dialogue`、`sw-korean-french-screenwriting` 的 description 改成 `>-` 块写法，原文未加引号的 `: ` 让 skills CLI 解析失败、装不上。

| skill | 给谁 | 做什么 |
|---|---|---|
| `sw-workflow` | 写剧本/短视频脚本的 agent | 剧本项目主线调度：前提→结构→人物→场景→初稿→修改→投递，每阶段该调哪个 sw-* skill、交什么；状态存在 `story-bible.md` |
| `sw-story-structure` | 写剧本/短视频脚本的 agent | 故事结构：Field 范式与情节点、Save the Cat 节拍、McKee 事件/场景/序列/幕、起承转合、八种开头与结尾 |
| `sw-premise-theme` | 写剧本/短视频脚本的 agent | 前提与主题：Egri 前提、McKee 主控思想、第三轨（欲望 vs 误信）、logline 检验、选材与戏核 |
| `sw-character-conflict` | 写剧本/短视频脚本的 agent | 人物与冲突：三维人物、对立统一、上升/静止/跳跃冲突，Freud/Jung/Campbell 动机模型，对手要强 |
| `sw-dialogue` | 写剧本/短视频脚本的 agent | 对白：对白即动作、说出/未说/不可说、暴露即弹药、人物专属词汇、七个场景分析 |
| `sw-scene-craft` | 写剧本/短视频脚本的 agent | 场景：价值转折、五步场景分析、晚进早出、节奏与转场、悬念/延宕/机趣、细节与道具 |
| `sw-format-adaptation` | 写剧本/短视频脚本的 agent | 格式与改编：spec 格式硬规则、Fountain 输出契约、中文场号制与日式柱・ト書き、分步大纲→treatment→剧本、改编原则 |
| `sw-american-case-studies` | 写剧本/短视频脚本的 agent | 美国电影案例：西部片、神经喜剧、Wilder、Hitchcock、《改编剧本》《冰血暴》《心灵捕手》等逐片拆解 |
| `sw-japanese-screenwriting` | 写剧本/短视频脚本的 agent | 日本编剧方法：十位导演/编剧的结构先行 vs 片段先行、小素材笔记、if+moreover、吐槽系统 |
| `sw-korean-french-screenwriting` | 写剧本/短视频脚本的 agent | 韩国与法国编剧方法：吴承昱、崔石焕、Obitan 的国际大师课 |
| `sw-industry-business` | 写剧本/短视频脚本的 agent | 编剧行业：买方视角、PROBLEM 测试、logline/query/pitch、经纪、期权、署名、影视差异 |
| `chekhov-dramaturgy` | 写剧本/短视频脚本的 agent | 契诃夫戏剧法：七部多幕剧与独幕剧的结构、人物、对白、舞台提示、修改（林妖→万尼亚舅舅） |
| `ozu-screenplay-style` | 写剧本/短视频脚本的 agent | 小津安二郎剧本法：六部剧本的共享骨架、嫁女结构、对白语域、主题句 |

okr skill 的规则都在 `docs/okr/PROTOCOL.md`，skill 只负责把协议接进对话：先 `okr protocol` 读它，再动手。skill 里只写「本 skill 固定的事」和「意图 → 协议章节」，不复制协议内容。

## 加一个 skill

1. `mkdir skills/<name>`，写 `SKILL.md`：frontmatter 只要 `name`（同目录名）和 `description`（触发条件写全，中英文关键词都放进去，agent 靠它决定要不要加载）。
2. 正文只写这个 skill 的固定规则和回复格式；依赖某个 CLI 或长文档的，第一段给出读取命令（照抄 okr skill 的写法），不把文档复制进 SKILL.md。
3. `evals/evals.json` 放 3–12 条 `{ id, prompt, expected_output }`，覆盖触发、常见路径和守卫被拒。
4. 在上表加一行；要让 CLI 自动装它的话，把它加进 `package.json` 的 `files` 和 `src/skill.ts`（目前只装 okr）。
5. 本地开发把它软链进 `~/.agents/skills/<name>`（见根 README「本地开发」），Claude Code 再软链 `~/.claude/skills/<name> -> ../../.agents/skills/<name>`。
