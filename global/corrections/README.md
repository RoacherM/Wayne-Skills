# Corrections

When the user corrects you, or says 记一下 / log this, leave a record here. When the same rule keeps coming back, promote it into an AGENTS.md so it stops depending on these records.

## Folders

- `open/`: records not yet promoted. Agents read their 规则 lines.
- `promoted/`: records whose rule now lives in an AGENTS.md or a skill, or that the user decided not to adopt. Agents do not read these.

## Write a record

Before writing, grep the 规则 lines in `open/` and `promoted/`. If a record with the same rule already exists, do not create a new one: add the user's new words and the date under its 触发 section. That counts as the rule showing up a second time.

Otherwise create `open/<YYYY-MM-DD>-<repo|global>-<slug>.md`. Use the repo's directory name for a rule about one repo, `global` for everything else.

```markdown
# <YYYY-MM-DD> <repo|global> <short title>

## 触发
The user's words, quoted.

## 分歧
What you did, and what the user wanted instead.

## 规则
One line, written like the rules in AGENTS.md.
```

## Read

The first time you work in a repo, read the 规则 lines of the `open/` records named for that repo and for `global`. Read a whole record only when you need its detail.

## Promote

Promote a record when its rule shows up a second time, or when the user says 以后 / 都 / 一直 / 不喜欢 / always / never.

- A repo rule goes into that repo's AGENTS.md.
- A global rule goes to the user as a proposed edit to `wayne-skills/global/AGENTS.md`. After the user agrees, edit that file and run `bash global/link.sh`, which copies it to `~/.agents/AGENTS.md`. Do not edit `~/.agents/AGENTS.md` directly; the next `link.sh` run overwrites it.
- Rewrite the file so the rule fits in, instead of appending a line. Keep the global file at 12 rules or fewer.

After the edit lands, move the record to `promoted/` and add a last line: `升级到：<file>:<line>（<date>）`. A record that an existing rule or skill already covers, or that the user decided against, also moves to `promoted/`, with a last line saying which rule covers it or what the user decided.
