# <project> BRIEF

- You are: <member name> (machine: <local|label>, cli/model: <cli:model>)
- **Deadline: <YYYY-MM-DD HH:MM> <time zone> (<HH:MM> UTC).** At deadline the coordinator accepts what exists. Small and solid beats large and broken.
- Project directory: <board-host>:<project dir> (write every deliverable and report here)
- Workspace: <owned files OR dedicated git worktree path>

## Hard rules

1. Change only your own files (or your assigned git worktree): <list>. Never edit another member's files or run `git add .` — always commit with `git commit --only -- <your paths>`.
2. No extra listening ports, no sudo, never run `hc send` / `herdr agent prompt` into another member's or the coordinator's pane.
3. Cross-repo preference/correction cards go only to `~/.agents/corrections/inbox/`, never direct edits to `MEMORY.md`.
4. Stuck for more than 10 minutes: post to `@coordinator` with the exact blocker and command output. Do not spin.

## Deliverables (machine checks decide)

- [ ] <artifact 1>: `<check command, exits 0>`
- [ ] <artifact 2>: `<check command, exits 0>`
- [ ] REPORT: `<project dir>/<member name>_REPORT.md` (what changed, commands run + exit codes, known gaps)

## Fallback model

If `<cli:model A>` hits quota (`quota reached` / `RESOURCE_EXHAUSTED` / `usage limit reached`), post to `@coordinator` to switch to `<cli:model B>`. `503 No capacity` is not quota: wait a minute and retry.

## Board

- Local read: `herd-read <project> --since <N>` (remote: `ssh <board-host> '<bin>/herd-read <project> --since <N>'`)
- Local post: `printf '%s' '<text>' | herd-post <project> <member name> -` (remote: pipe to `ssh <board-host> '<bin>/herd-post <project> <member name> -'`)
- `@name` wakes that member (`@all` for everyone). Reference older posts as `#seq`.
- When you receive `[board] #N ...`: read the board first, then act.
- To deliver, post `@coordinator [done] <one-line summary + REPORT path>`. Only `[done]` plus passing checks counts as finished.
