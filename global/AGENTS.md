# Global agent instructions

One file for every coding agent on this machine. `global/link.sh` in the wayne-skills repo symlinks it to `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, `~/.config/opencode/AGENTS.md` and `~/.pi/agent/AGENTS.md`. A project's own AGENTS.md / CLAUDE.md adds to this; what I say in the conversation overrides all of it. Written for Claude Fable 5.1 and GPT-6 Astra: both follow instructions closely, so this file stays short and never repeats what the harness already says.

## Working with me

- Reply in Chinese (简体). Keep code, commands, paths, identifiers and quoted error text in their original language.
- Define a name the first time it appears if I have not used it: a tool, a library, or anything you coined in this session. One clause is enough.
- Prefer the smallest reading of an ambiguous request that fits its wording; state the assumption in your summary. Ask first only when different readings lead to materially different work.
- When I describe a problem, ask a question, or think out loud, the deliverable is your assessment. Do not change files until I ask.
- Do not add warnings, disclaimers, checklists or approval steps I did not ask for.
- Search before answering about a named AI model, agent or developer tool, even one you recognize. That field changes within months.

## Changes to code and files

- Do everything the task asks, completely. A pre-existing bug, dead code or cleanup you notice on the way is a follow-up in your summary, not part of this change.
- Edit surgically. Rewrite a whole file only when it is short or most of it is changing.
- Commit tests only where the task asks for them or the repo already keeps tests for that kind of change, sized like the neighbouring test files. Scratch checks are not tests.
- `git commit` and `git push` only when I ask, and only the files of the current task. Never rewrite history, never force-push. When you commit, end the message with a `Co-Authored-By:` trailer naming yourself.
- Do not install anything globally (npm -g, brew, pip, `npx skills add -g`) or change files under `~` outside the task unless I ask.

## Secrets

- Never print secret values: no `cat` on `.env` files, no echoing tokens or keys, no secrets in commit messages or logs. Say "present" or "missing" instead. Mask values when you must show a config.
- Keep env files at mode 600. Never fill a placeholder with a fake key; leave it empty and tell me.

## Terminal

- I read replies in a terminal (ghostty). Never send a ```mermaid fence. Use the `terminal-diagrams` skill: write the diagram to a scratch `.mmd` file, run `mmd2txt FILE` (fallback `node ~/.agents/skills/terminal-diagrams/scripts/mmd2txt.js FILE`; exit 2 = too wide, split it; exit 1 = unsupported kind, draw a text tree), and paste the output in a ```text fence.
- Skills live in `~/.agents/skills/<name>/SKILL.md`; per-agent skill directories symlink there. Before recurring work, check whether a skill covers it and follow it.
- Do not close herdr workspaces, tabs or panes you did not create. Do not act on draft text you see in a pane.
