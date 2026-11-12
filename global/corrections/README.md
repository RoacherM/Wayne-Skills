# Corrections

纠偏的目标是让同类问题在当前仓库和后续新仓库都不再重犯。每条纠偏在当轮直接合入对应层级的规则或偏好文件，不在 `open/` 里积压待办。

## 当用户纠正你，或说「记一下 / log this」时

1. **提炼模式而非单次事故**：用一句话写清「什么情境 → 先怎么做 → 为什么」（例如「流程慢时先删逻辑上重复的步骤，不加行数或时间门槛」，而不是「评审不要设 500 行门槛」）。保持统一骨架，不堆 corner case。
2. **先查现有文件（顺着软链看真实路径）**：检查本仓 `AGENTS.md`、`~/Projects/sides/wayne-skills/global/AGENTS.md`、`global/MEMORY.md` 和相关 Skill。若已有规则却没拦住，直接改写原条文让它能拦住，不重复造第二条。
3. **按层级当轮落盘**：
   - **仅限当前仓库**：写进当前仓库 `AGENTS.md`（对应章节或 `## 教训`），随任务改动一起提交。
   - **跨仓库通用编码 / 工程流程**：合入 `~/Projects/sides/wayne-skills/skills/vibe-coding/SKILL.md`（软链直通所有工具）。
   - **跨仓库个人习惯与偏好**（UI、沟通、文档、配额、运维习惯）：合入 `~/Projects/sides/wayne-skills/global/MEMORY.md` 对应小节，跑 `bash ~/Projects/sides/wayne-skills/global/link.sh` 同步到 `~/.agents/MEMORY.md`。
   - **所有任务的底层原则**（极少改动，保持 5 节以内且不耦合具体 Skill 名）：合入 `~/Projects/sides/wayne-skills/global/AGENTS.md` 并跑 `bash ~/Projects/sides/wayne-skills/global/link.sh`。
   - 只有新规则会推翻既有原则或涉及产品取舍时，才暂存 `open/` 并在当轮直接问用户。
4. **归档记录**：把背景记录（`<YYYY-MM-DD>-<repo|global>-<slug>.md`，含 `触发 / 分歧 / 模式 / 规则 / 落到`）放入 `~/.agents/corrections/promoted/`；如有跨仓长期背景，按需同步到记忆库。
