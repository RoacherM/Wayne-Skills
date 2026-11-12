# Corrections

纠偏的目标是让同类问题在当前仓库和后续新仓库都不再重犯，同时支持多个分屏/仓库并行开发而不发生写冲突或越界改仓。

## 当用户纠正你，或说「记一下 / log this」时

1. **提炼模式而非单次事故**：用一句话写清「什么情境 → 先怎么做 → 为什么」（例如「流程慢时先删逻辑上重复的步骤，不加行数或时间门槛」），保持统一骨架，不堆 corner case。先读 `~/.agents/MEMORY.md` 与当前仓库 `AGENTS.md`，避免重复记已有条文。
2. **仅限当前仓库 → 直接改本仓 `AGENTS.md`**：写进当前打开仓库的 `AGENTS.md`（对应章节或 `## 教训`），随任务改动一并提交。
3. **跨仓库经验 → 投递单文件到 `inbox/`（严禁从业务仓跨界直改 `wayne-skills` 或 `~/.agents/MEMORY.md`）**：
   新建唯一命名的卡片 `~/.agents/corrections/inbox/<YYYYMMDD-HHMMSS>-<slug>-<pid>.md`（目录不存在先 `mkdir -p`），物理避免多 Agent 并发覆写：

   ```markdown
   ---
   target: MEMORY.md#编码与验证
   rule: - **短标题**：什么情境 → 怎么做，为什么。
   ---

   ## 触发
   用户的纠正原意与当时场景

   ## 分歧
   原先的做法 vs 实际需要的协作或工程模式
   ```

   `target` 按层级三选一：
   - `MEMORY.md#<界面与原型|编码与验证|文档与沟通|环境与配额>`：个人工作习惯与跨项目偏好。
   - `vibe-coding`：跨仓库通用编码规范或工程流程。
   - `AGENTS.md`：所有任务的底层原则（极少改动，保持 5 节以内且不耦合具体 Skill 名）。
   - 若新规则会推翻既有原则或涉及产品取舍，改放 `~/.agents/corrections/open/` 并在当轮直接问用户。

## 汇总合入（收口或维护 `wayne-skills` 时执行）

```bash
W=~/Projects/sides/wayne-skills/bin/wayne-skills.js
node "$W" inbox           # 列出 inbox/ 中待合入的纠偏卡
node "$W" inbox --apply   # 加锁合入 MEMORY.md#<小节>（自动去重、同步 global/MEMORY.md 与 ~/.agents/MEMORY.md，归档至 promoted/）
```

`target` 为 `vibe-coding` 或 `AGENTS.md` 的卡片在 `--apply` 时保留在 `inbox/` 供人工审阅合入，防止核心常驻规则自动膨胀；合入完在 `wayne-skills` 仓库提交即可。
