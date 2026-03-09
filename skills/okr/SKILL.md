---
name: okr
description: "Git-native OKR tracking with AI intelligence. Use when: (1) initializing OKR tracking ('set up OKR', 'init okr', '帮我建OKR'), (2) recording progress in natural language ('retention improved to 45%', 'data platform shipped', 'hiring blocked', '精度提升到90%', '被阻塞了', '完成了'), (3) checking OKR status ('how are we doing', 'show progress', 'dashboard', 'OKR进度怎样', '看板'), (4) revising spec ('adjust target', 'cancel KR', 'freeze KR', '调整目标', '取消KR'), (5) closing a quarter ('close quarter', 'wrap up Q1', '季度关闭'), (6) visualizing progress ('metro map', '可视化', '地铁图'). Triggers: /okr, any KR progress update, metric change, blocker report, okr init/status/revise/close, metro map. Even if user doesn't say 'OKR' explicitly — if they mention KR progress, quarterly goals, or metric updates related to their OKR setup, use this skill."
---

# OKR Git Tracker

OKR repo: `~/.okr`. All operations target this repo regardless of current working directory.

## Event Format

**3 KR prefixes — the only event types:**

| Prefix | Meaning | Dot | When |
|--------|---------|-----|------|
| `progress` | Forward movement | ● circle | Metric change, discussion, research, correction |
| `done` | Delivered | ◆ diamond | KR or milestone shipped |
| `blocked` | Stuck | ■ square | Waiting on external dependency |

**Commit format:** `prefix(scope): description [metric=value/target]`
- Scope: `krN` (KR trunk) or `krN/project` (project sub-track)
- Metric suffix is optional, recommended for `progress`
- Milestone: commit message containing "milestone" or "reached target"

**Admin commits (main branch only, not KR events):**
```
init: okr tracking {YYYY}Q{N}
revise(krN): description of change
close: Q{N} {YYYY} final O1=X% O2=Y%
```

**Examples:**
```
progress(kr1): retention rate improved ret=45%/50%
done(kr1/user-seg): shipped user segmentation model
blocked(kr1/rec-v2): waiting on data team
progress(kr3): accuracy corrected acc=76%/95%
```

## okr.md Spec Format

Spec-only file on main branch. Contains structure and targets. NO progress bars, NO blocked items, NO recent activity.

```markdown
# OKR Spec {YYYY} Q{N}

> Type: 工作绩效 | Quarter: Q{N} ({months}) | Project: {name}

## O1 {Objective Title}

**KR1 {Name}** `{alias}` {weight}%
  metric: {type} | baseline: {value} | target: {value}

**KR2 {Name}** `{alias}` {weight}%
  metric: {type} | baseline: {value} | target: {value}
```

- Alias: unique ASCII ID for commits and matching
- State markers: `[canceled]`, `[frozen]` — set by revise only
- Modified ONLY by: init, revise, close (all on main)
- KR numbering: sequential across all objectives

## Routing

Check `~/.okr/okr.md` existence. If missing → init. Otherwise classify into 5 intents:

- **init**: "set up", "initialize", "create okr"
- **commit**: any progress update, metric change, blocker, deliverable
- **status**: "show", "progress", "dashboard", "how are we doing"
- **revise**: "adjust target", "change weight", "cancel KR", "freeze KR"
- **close**: "close quarter", "end cycle", "wrap up Q1"

## Init

1. Create `~/.okr` as git repo (main branch)
2. OKR structuring guidance:
   - Collect dimensions: time range, type, project/team
   - Help structure into Objective + KR format
   - For each KR: name, alias, metric type, baseline, target, weight
   - Grade mapping if applicable: D=40%, C=60%, B=80%, A=100%
   - Validate weights sum per objective, confirm baselines
3. Generate `okr.md` in spec format (spec only, NO progress)
4. Create directories: `log/`, `bin/`
5. Copy `templates/metro` to `~/.okr/bin/metro`, `chmod +x`
6. Commit on main: `init: okr tracking {YYYY}Q{N}`
7. Create KR branches: `{YYYY}Q{N}/kr/{NUM}-{slug}` per KR
8. Show git graph + spec preview

## Smart Commit

User speaks one sentence → AI detects KR + prefix → commits on correct branch → shows progress delta.

### KR Matching (Safety Gate)

```
1. Exact alias/number match     → direct write
2. Unique keyword match         → direct write
3. Multiple candidates          → LIST OPTIONS, ASK USER (hard interrupt)
4. Zero matches                 → error: "未找到匹配的KR"
```

**Step 3 is non-negotiable. NEVER silently guess when ambiguous.**

### Workflow

1. Read `~/.okr/okr.md` from **main HEAD** for O/KR structure
2. Match user input to KR using safety gate above
3. Determine prefix: progress / done / blocked
4. Commit via checkout (no worktree):
   ```bash
   git -C ~/.okr checkout {branch}
   git -C ~/.okr commit --allow-empty -m "prefix(scope): description [metric=value/target]"
   git -C ~/.okr checkout main
   ```
5. Derive progress from git log (NOT from file)
6. Show one-line confirmation with progress delta
   - Milestone → celebrate briefly
   - Blocked >7 days → flag [!]

**CRITICAL**: NEVER update okr.md for progress. The commit message IS the data.

### Batch Updates

When user provides multiple KR updates in one message:
1. Parse ALL updates first
2. Present summary for confirmation
3. Commit each in sequence after user confirms

## Status

Compute dashboard from spec + git log. NEVER persist dashboard to file.

### Projection (single definition — status and metro share this)

1. Read `okr.md` from main HEAD → parse O/KR structure
2. Scan: `git -C ~/.okr log main --all --format="%H|%s|%ad" --date=iso`
3. Per-KR state (from commit messages matching `(progress|done|blocked)(krN)`):
   - `progress` → update current metric (last-write-wins)
   - `done` → mark completed
   - `blocked` → mark blocked (resolved by subsequent progress/done on same scope)
4. Progress: `(current - baseline) / (target - baseline) * 100`
   - Grade metric: D=40, D+=50, C-=55, C=60, C+=70, B-=75, B=80, B+=85, A-=90, A=95, A+=100
   - Milestone metric: count `done()` events / expected milestones
5. Health: `on-track` if progress% ≥ elapsed%-10, `at-risk` if ≥ elapsed%-25, `behind` otherwise
6. Inactivity: warn if no commits for 14+ days

### Dashboard Display

```
# OKR Dashboard {YYYY} Q{N}
> Computed: {date} | Elapsed: {elapsed}%

## O{N} {Title}

**KR{N} {Name}** `{alias}` {weight}%  {baseline}→{target}  {metric}={current}  **{progress}%** [{health}]
████████████░░░░░░░░

### Blocked Items
| KR | Scope | Days | Reason |
|----|-------|------|--------|

### Recent Activity
- {prefix}({scope}): {description} ({date})
```

## Metro Map

Visual metro map. Generates `~/.okr/log/metro.html`.

Source template: `templates/metro` (copy to `~/.okr/bin/metro` during init, keep in sync).

```bash
~/.okr/bin/metro                     # all quarters
~/.okr/bin/metro --quarter 2026Q1    # specific quarter
~/.okr/bin/metro --no-open           # generate without opening
```

Suggest after: status checks, multiple commits in one session, user asks about visualization.

## Revise

Modify OKR spec on main branch.

1. Read current spec from `okr.md` on main
2. Apply change:
   - **Change target/weight/name**: update okr.md, commit `revise(krN): description`
   - **Add KR**: add to spec, create new branch, commit on main
   - **Cancel KR**: mark `[canceled]` in spec, commit `revise(krN): canceled at {progress}%`
   - **Freeze KR**: mark `[frozen]` in spec, commit `revise(krN): frozen, carry-over to Q{N+1}`
   - **Unfreeze KR**: remove `[frozen]`, commit `revise(krN): unfrozen, resumed`
3. Show updated spec preview
4. Revise NEVER touches KR branches — only modifies okr.md on main

## Close

Quarter close: score, merge, tag, clean up.

1. Run status derivation for final scores
2. Present summary, ask for qualitative assessment per KR
3. Commit on main: `close: Q{N} {YYYY} final O1={score}% O2={score}%`
4. Merge all KR branches: `git merge --no-ff {branch}` per KR
5. Tag: `git tag -a v{YYYY}-Q{N} -m "Quarter close"`
6. Delete merged branches: `git branch -d {branch}`
7. Canceled: merge for audit trail, then delete
8. Frozen: merge, carry-over to next quarter (re-create in new namespace)
9. Ask about carry-over: which active KRs to bring to next quarter?
10. Show final git graph
