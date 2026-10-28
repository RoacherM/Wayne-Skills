---
name: ub-mode
description: Measure code with crapper (complexity × coverage), dryer (duplication) and mutator (mutation tests). Use when writing, changing or reviewing code.
---

# ub-mode

Three instruments that grade code from outside, in Clojure, Java, Go, TypeScript/JavaScript, Rust and Python. They are Robert C. Martin's tools (github.com/unclebob/crapper, dryer, mutator; 0BSD), copied into this skill's `tools/`.

| Tool | Measures | Target |
|---|---|---|
| crapper | CRAP = CC² × (1 − coverage)³ + CC, per function (CC: cyclomatic complexity) | under 10 |
| dryer | pairs of functions with the same structure, names and literals ignored (score 0–1) | no pair worth merging |
| mutator | small code changes (`>=` → `>`, `1` → `0`) that the tests fail to catch | no survivor in changed code |

## Run

```bash
sh <skill dir>/scripts/ub crapper [args]    # from the project root; --help on each tool lists every flag
sh <skill dir>/scripts/ub dryer [args]
sh <skill dir>/scripts/ub mutator [args]
```

The first call builds one shared Python environment with `uv` in `~/.cache/ub-mode` (seconds); later calls start at once. Paths narrow a run (`ub crapper src/billing`), and `--changed` takes the files `git status` lists.

## Using them

You choose when to run them, on what, and what to do with the result. These facts shape the choice:

- CRAP is never lower than CC. A function with CC ≥ 10 cannot pass through tests alone; it needs a split.
- Without coverage, CRAP is blank. A full crapper run reruns the project's tests to get coverage (`--use-existing-coverage` reads reports on disk; `--no-coverage` scores CC only, in seconds). A slow suite makes the full run slow.
- In code that was already over the target, a lower score than the base commit is a pass.
- The walk ignores `.gitignore`: it skips only fixed names (`node_modules`, `dist`, `target`, `test`, …), and a word that is not a path is a filter on every path. Nested checkouts (worktrees under ignored folders) get scored, and each nested `package.json` gets its own coverage run. Name real paths (`src/errors.ts`, `src/`).
- `--changed` reads `git status`: uncommitted files only, and it scores every function in them. Judge the functions you touched.
- dryer flags short look-alikes (two 3-line constructors score 1.0). Merge when the two carry one decision; keep them apart when they only share shape.
- mutator runs the tests once per mutant and skips lines no test covers (reported as UNCOVERED). Point it at the files you changed. A survivor names a behaviour no test pins.
- For Python, the tools run the project's `.venv/bin/python` (else `python3`) and install `coverage`/`pytest` into it when missing. With no project venv on a Homebrew Python that install fails and coverage reads 0%: create `.venv` first.
- For TypeScript, coverage comes from `npm run coverage`, Vitest `--coverage` (it may add `@vitest/coverage-v8` to `node_modules`), or `c8` around `npm test`.
- The tools write `.metrics/` and `target/coverage/`. Keep them out of commits (`.git/info/exclude`), and keep `package.json` and lockfiles unchanged.
- When a score stays over the target because the fix costs more than it buys, say so with the number.

## Report

Give the numbers: worst CRAP before → after for the functions you touched, duplicate pairs merged or kept, mutation score.
