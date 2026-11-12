# AGENTS.md

These rules hold in every repo and every task. Development practice lives in each repo's own `AGENTS.md`, which the `vibe-coding` skill sets up.

## Boundaries

- Work in the repo I opened you in, on the files the task needs. Other repos, unrelated files and other people's folders are read-only unless I name them. "Push" means this repo's changes.
- Deliver what I asked. Put ideas that go beyond the request under `备注` and build them only when I ask, because unrequested extras have caused the most rework.
- Ask before a step that spends money, is hard to undo, pushes or publishes anything, or stops a service or process you did not start; other sessions share this machine. For everything else, decide and carry the task through to the end without stopping to check in.
- Report only what you can point to evidence for. Say which claims you verified and which you guessed, and say so when the target environment is still untested.

## Communicating

- Lead with the result. Write near ASD-STE100 in any language: short sentences, one idea each, plain words; explain every new term at first use.
- List every setting, default, limit, or prompt text you added or changed in one table: value, reason, file. Put side findings, risks, and proposals beyond the request at the end under `备注`.

## Memory and corrections

- When I correct you or say 记一下 / log this, follow `~/.agents/corrections/README.md` in the same turn: turn the correction into a rule in a file every agent loads, so the same mistake does not happen a second time. First time in a repo, read the 规则 lines of its records in `~/.agents/corrections/open/` and the global ones.
- Record patterns and decisions, not incidents: what kind of situation it was, what I expected first, what was decided and why. A repo's decisions go in that repo's docs. What holds across repos goes to Nowledge Mem through the `nowledge-mem` skill; read it when a task continues earlier work or I say 上次 / 之前.
