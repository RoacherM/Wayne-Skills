# Corrections

A correction is worth keeping only if it stops the same mistake from happening again. A memory that an agent must search for does not do that. A rule in a file that every agent loads does. So each correction ends, in the same turn, as one rule in the right always-loaded file. The folders here keep the record behind each rule.

## When the user corrects you, or says 记一下 / log this

1. **Name the pattern.** Say what kind of situation this was and what to do first in it, in one line, so the rule also covers the next case that looks different. "流程慢时先找逻辑上重复的那一步，不加数值门槛" is a pattern. "评审不要用 500 行做门槛" is a detail of one incident.
2. **Look for an existing rule.** Grep the repo's `AGENTS.md`, `~/.agents/AGENTS.md`, and the 规则 lines in `open/` and `promoted/`. If the rule exists and the mistake still happened, the rule failed: rewrite it so it would have caught this case, and add the user's new words and the date under 触发 in its record. Do not write a second rule.
3. **Put the rule where it will be read.**
   - It is about this repo: write it into this repo's `AGENTS.md` now. Fit it into the section it belongs to; use `## 教训` when none fits. Give the reason in the same line. Commit it with your other changes.
   - It applies beyond this repo: write it into this repo's `AGENTS.md` now as well, so it holds here at once. Then leave the record in `open/` as a proposal. Development practice belongs in `wayne-skills/skills/vibe-coding/references/agents-template.md`; a rule for every task belongs in `wayne-skills/global/AGENTS.md`. Edit those only after the user agrees, then run `bash global/link.sh`.
4. **Write the record** (format below). A record whose rule has landed goes straight to `promoted/`.
5. **Save the pattern to memory** with the `nowledge-mem` skill: how the user found the problem and what they expected you to do first. This is for recall in other repos; it does not replace step 3.

## Folders

- `open/`: rules that apply beyond one repo and wait for the user's decision. Agents read their 规则 lines the first time they work in a repo.
- `promoted/`: records whose rule has landed in an `AGENTS.md` or a skill, or that the user decided against. Agents do not read these.

## Record format

`<YYYY-MM-DD>-<repo|global>-<slug>.md`. Use the repo's directory name for a rule about one repo, `global` for everything else.

```markdown
# <YYYY-MM-DD> <repo|global> <short title>

## 触发
The user's words, quoted.

## 分歧
What you did, and what the user wanted instead.

## 模式
How the user found the problem, and what they expected you to do first.

## 规则
One line, written like the rules in AGENTS.md: the kind of situation, what to do, why.

落到：<file>#<heading>（<date>）
```

## Keep the rule files short

Rewrite a file so the new rule fits in, instead of appending a line. Merge rules that share a cause. Delete a rule when its reason no longer holds, and say so in its record. Keep `wayne-skills/global/AGENTS.md` at 12 rules or fewer.
