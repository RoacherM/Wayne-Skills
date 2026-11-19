---
name: ub-mode
description: Measure code with crapper (complexity × coverage), dryer (duplication), mutator (mutation tests), and run the ub check static gate (test honesty and silent error fallbacks). Use when writing or changing code.
---

# ub-mode

Three external scoring instruments plus one local static gate, sharing a single `uv` Python environment (`tree-sitter-language-pack`) in `~/.cache/ub-mode`.

| Tool | Kind | Measures / Enforces | Target |
|---|---|---|---|
| `crapper` | Score | CRAP = CC² × (1 − coverage)³ + CC, per function (CC: cyclomatic complexity) | under 10 |
| `dryer` | Score | Pairs of functions with the same structure, names and literals ignored (0–1) | no pair worth merging |
| `mutator` | Score | Small code changes (`>=` → `>`, `1` → `0`) that tests fail to catch | no survivor in changed code |
| `check` | **Pass/Fail gate** | Cross-language (Python, JS/TS, Rust) test honesty & silent error fallbacks (`no-fixed-sleep`, `no-flake-masking`, `no-skipped-or-empty-test`, `no-silent-fallback`) | 0 errors (exit 0) |

`crapper`, `dryer`, and `mutator` are Robert C. Martin's tools (`github.com/unclebob/crapper`, `dryer`, `mutator`; 0BSD), copied unchanged into `tools/` so `tools/vendor.sh` tracks upstream directly. `check` lives separately in `check/`.

## Run

```bash
sh <skill dir>/scripts/ub check --changed     # fast static gate on changed files (or pass explicit paths; --json supported)
sh <skill dir>/scripts/ub crapper [args]      # from the project root; --help on each tool lists every flag
sh <skill dir>/scripts/ub dryer [args]
sh <skill dir>/scripts/ub mutator [args]
```

The first call builds one shared Python environment with `uv` in `~/.cache/ub-mode` (seconds); later calls start at once. Paths narrow a run (`ub crapper src/billing`), and `--changed` takes the files `git status` lists.

## `ub check` (pass/fail gate)

Unlike the three scoring instruments, `ub check` is a binary gate with zero `warn` tier:
- Exit codes: `0` clean, `1` violations found, `2` runner/git error (never silently degrades to pass), `64` bad CLI arguments (including combining `--changed` with explicit paths). Real syntax errors stay with `oxlint` / `ruff` / `tsc`.
- `--changed` compares each modified or renamed file against its `HEAD` baseline and reports only newly introduced violations (including hollowed tests, removed skip reasons, or widened `except` clauses) while staying silent on untouched legacy debt and pure `git mv` renames; untracked/newly added files are checked in full.
- Respects `.gitignore` (`git ls-files -co --exclude-standard`), skips `dist`/`vendor`/`node_modules`/`*.min.js`, and classifies test files relative to the git repository root.
- **Inline exemption** (standalone comment applies to the next line only; trailing comment applies to the same line only; non-empty reason mandatory, otherwise fails with `invalid-allow-comment`):
  - Python: `# ub-check: allow <rule>: <reason>`
  - JS/TS/Rust: `// ub-check: allow <rule>: <reason>`

## Using the scoring instruments

You choose when to run them, on what, and what to do with the result. Independent diff review follows the `vibe-coding` skill (`统一评审规则`): pre-review checks already run the test suite, so skip full crapper and mutator runs during review unless the user asks, to avoid rerunning slow suites in reviewer sessions. These facts shape the choice:

- CRAP is never lower than CC. A function with CC ≥ 10 cannot pass through tests alone; it needs a split.
- Without coverage, CRAP is blank. A full crapper run reruns the project's tests to get coverage (`--use-existing-coverage` reads reports on disk; `--no-coverage` scores CC only, in seconds). A slow suite makes the full run slow.
- In code that was already over the target, a lower score than the base commit is a pass.
- The walk ignores `.gitignore`: it skips only fixed names (`node_modules`, `dist`, `target`, `test`, …), and a word that is not a path is a filter on every path. Nested checkouts (worktrees under ignored folders) get scored, and each nested `package.json` gets its own coverage run. Name real paths (`src/errors.ts`, `src/`).
- `--changed` reads `git status`: uncommitted files only, and it scores every function in them. Judge the functions you touched.
- dryer flags short look-alikes (two 3-line constructors score 1.0). Merge when the two carry one decision; keep them apart when they only share shape.
- mutator runs the tests once per mutant and skips lines no test covers (reported as UNCOVERED). Point it at the files you changed. A survivor names a behaviour no test pins.
- mutator runs each mutant in a worker folder of symlinks to the project. A test that finds the source through a resolved path (Python `Path(__file__).resolve()` on `sys.path`, an absolute import root) loads the real, unmutated file, and every mutant survives. When everything survives, apply one mutant by hand and run the tests to diagnose that path issue (e.g. pytest `pythonpath = ["src"]`) — **never report hand-edited manual mutations as a substitute for running `ub mutator`**. If `ub mutator` cannot run, fix the blocker or report it explicitly and stop.
- For Python, `scripts/ub` preflights `.venv/bin/python` (or `venv/bin/python`) whenever the target includes `.py` files (even in repos without `pyproject.toml`) while skipping non-Python targets in mixed repos. Because `uv venv` omits `pip` by default, `crapper` and `mutator` cannot auto-install `coverage` into a bare `uv` venv: prepare the project with `uv venv && uv pip install -e . coverage pytest` (or `uv pip install --python .venv/bin/python coverage pytest` in script-only repos without `pyproject.toml`, dropping `pytest` for stdlib `unittest` projects) before running.
- For TypeScript, coverage comes from `npm run coverage`, Vitest `--coverage` (it may add `@vitest/coverage-v8` to `node_modules`), or `c8` around `npm test`.
- The tools write `.metrics/` and `target/coverage/`. Keep them out of commits (`.git/info/exclude`), and keep `package.json` and lockfiles unchanged.
- When a score stays over the target because the fix costs more than it buys, say so with the number.

## Report

Give the numbers: `ub check` pass/errors, worst CRAP before → after for the functions you touched, duplicate pairs merged or kept, mutation score.
