<!-- okr：追加到 ~/.codex/AGENTS.md 或 ~/.gemini/GEMINI.md（Codex / Gemini 通用片段）。支持 skill 的 agent（Claude Code / Codex / Gemini）用 npx skills add RoacherM/Wayne-Skills -s okr -g -a <agent> 装 skill 即可（CLI 打包在 skill 里），不需要这段。 -->

## okr（目标与任务追踪）

用户的目标 / KR / 任务 / 习惯记在 `~/.okr`，只通过命令行工具 `okr` 读写。用户提到 OKR、KR、目标进度、指标到了多少、任务做完 / 卡住 / 提了 PR、习惯打卡、周计划、拆任务，或你拿到一份「派工包」（`okr show <id> --spec` 的输出）时，先读协议再动手：

```bash
okr protocol 2>/dev/null || cat "$(dirname "$(readlink -f "$(command -v okr)")")/../docs/okr/PROTOCOL.md"
```

协议之外，这里固定几条：

- 写入一律 `--by codex --json`（Gemini 用 `--by gemini`），读也 `--json`，自己解析后用中文一句话回用户。
- 会话里第一次碰 okr 先 `okr brief --json`，`empty` 为 true 就不提。做周计划先 `okr week --json`、`okr candidates --json` 取数，提案给用户看过后写成 `reports/<周>.plan.yaml`，再 `okr apply --from <file> --confirmed`。
- 日报 / 周报：`okr changes --since last-daily --json` / `okr report data --json` 取数写 markdown，`okr report write --kind daily|weekly --from <md>` 入库，`okr deliver notes --from <md>` 推备忘录；周报的提案块存 `reports/<周>.plan.yaml`。定时跑靠 `okr job install`（协议 §11），让用户自己装。
- 给用户看板：`okr status` / `okr tree` / `okr week` 在管道里是 80 列纯文本，原样贴；要 markdown 加 `--md`。
- 写之前 `okr recent --node <id> --days 7 --json` 查重；指代歧义（退出码 2）列候选让用户选；需要 `--confirmed` 的事（加 / 挪 / 删节点、取消、KR / 目标 / 里程碑完成、落周计划）先说清楚等用户点头；被守卫拒绝（退出码 3）不自作主张 `--force`。
- 数值（`--value` `--hours`）只写用户口述的，不推算。
- 在某个仓库里干活时看仓库根目录的 `.okr.yaml`（`node: kr1`）决定默认记到哪个节点。
- 作为执行 agent（拿到派工包）只写四种事件：`okr claim <id> --by codex --session <worktree>`、`okr block <id> "卡在哪" …`、`okr log <id> "…" …`、验证命令通过并提 PR 后 `okr submit <id> --link <PR> …`。不写 `done` / `assess` / `add` / `edit`。
- 不直接改 `~/.okr` 里的文件，不在 `~/.okr` 里跑 git。
