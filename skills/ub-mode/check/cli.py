"""CLI entry point for `ub check`."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from dataclasses import asdict
from pathlib import Path

from check.js_rules import check_jsts
from check.model import Finding, apply_allow_comments, grammar_of, parse_file
from check.py_rules import check_python
from check.rs_rules import check_rust

SKIP_DIRS = {
    ".git",
    ".hg",
    ".svn",
    ".idea",
    ".venv",
    "venv",
    "node_modules",
    "vendor",
    "target",
    "dist",
    "build",
    "out",
    "coverage",
    ".metrics",
    ".scratch",
    ".local",
    ".next",
    ".astro",
    "__pycache__",
}

HELP = """\
Usage: ub check [--changed] [--json] [path ...]

Run cross-language test-honesty and silent-fallback static checks (Python, JS/TS, Rust).
Exit codes: 0 clean, 1 findings detected, 2 runner error, 64 usage error.

Options:
  -h, --help   Print this help and exit.
  --changed    Check added and modified files from git status.
  --json       Print findings as JSON.

Inline exemption (same line or line above, non-empty reason required):
  # ub-check: allow <rule>: <reason>   (Python)
  // ub-check: allow <rule>: <reason>  (JS/TS/Rust)
"""


def _parse_args(argv: list[str]) -> tuple[str, list[str], str]:
    mode = "scan"
    fmt = "text"
    paths: list[str] = []
    for arg in argv:
        if arg in {"-h", "--help"}:
            return "help", [], fmt
        if arg == "--changed":
            mode = "changed"
        elif arg == "--json":
            fmt = "json"
        elif arg.startswith("-"):
            raise ValueError(f"Unknown option: {arg}")
        else:
            paths.append(arg)
    return mode, paths, fmt


def _run_git(root: Path, args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "-C", str(root), *args],
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )


def _git_repo_root(root: Path) -> Path | None:
    proc = _run_git(root, ["rev-parse", "--show-toplevel"])
    if proc.returncode != 0:
        return None
    return Path(proc.stdout.strip()).resolve()


def _is_within(path: Path, base: Path) -> bool:
    try:
        path.relative_to(base)
        return True
    except ValueError:
        return False


def _parse_porcelain_paths(raw: str) -> list[str]:
    entries = raw.split("\0")
    rels: list[str] = []
    idx = 0
    while idx < len(entries):
        entry = entries[idx]
        idx += 1
        if len(entry) < 4:
            continue
        code, rel = entry[:2], entry[3:]
        if "R" in code or "C" in code:
            idx += 1
        if "D" not in code:
            rels.append(rel)
    return rels


def _changed_files(root: Path) -> list[Path]:
    repo_root = _git_repo_root(root)
    if repo_root is None:
        raise RuntimeError("--changed requires a git repository")
    status = _run_git(root, ["status", "--porcelain", "-z", "-uall"])
    if status.returncode != 0:
        raise RuntimeError(status.stderr.strip() or "git status failed")
    out = [
        full
        for rel in _parse_porcelain_paths(status.stdout)
        for full in [(repo_root / rel).resolve()]
        if full.is_file() and grammar_of(full) is not None and _is_within(full, root)
    ]
    return sorted(set(out), key=lambda p: p.as_posix())


def _git_listed_files(target: Path) -> list[Path] | None:
    if _git_repo_root(target) is None:
        return None
    proc = _run_git(target, ["ls-files", "-co", "--exclude-standard", "-z"])
    if proc.returncode != 0:
        return None
    out: list[Path] = []
    for rel in proc.stdout.split("\0"):
        if not rel:
            continue
        full = (target / rel).resolve()
        if full.is_file() and grammar_of(full) is not None:
            out.append(full)
    return out


def _walk_dir(target: Path) -> list[Path]:
    git_files = _git_listed_files(target)
    if git_files is not None:
        return git_files
    found: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(target):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            p = Path(dirpath) / name
            if grammar_of(p) is not None:
                found.append(p.resolve())
    return found


def _collect_files(mode: str, raw_paths: list[str], root: Path) -> list[Path]:
    if mode == "changed":
        return _changed_files(root)
    targets = [
        (Path(p) if Path(p).is_absolute() else root / p)
        for p in (raw_paths or ["."])
    ]
    files: set[Path] = set()
    for target in targets:
        if not target.exists():
            raise FileNotFoundError(f"path not found: {target}")
        if target.is_file():
            if grammar_of(target) is not None:
                files.add(target.resolve())
        else:
            files.update(_walk_dir(target))
    return sorted(files, key=lambda p: p.as_posix())


def _rel_path(path: Path, root: Path) -> Path:
    try:
        return path.relative_to(root)
    except ValueError:
        return Path(path.name)


def _check_one(path: Path, root: Path) -> list[Finding]:
    rel = _rel_path(path, root)
    display = rel.as_posix() if _is_within(path, root) else path.as_posix()
    source = path.read_text(encoding="utf-8", errors="replace")
    parsed = parse_file(display, rel, source)
    if parsed is None:
        return []
    if parsed.grammar == "python":
        raw = check_python(parsed)
    elif parsed.grammar == "rust":
        raw = check_rust(parsed)
    else:
        raw = check_jsts(parsed)
    return apply_allow_comments(parsed, raw)


def _format_text(findings: list[Finding], file_count: int) -> str:
    if not findings:
        return f"ub check: clean ({file_count} file(s), 0 errors)\n"
    lines = [
        f"[ERROR] {item.file}:{item.line}:{item.column} {item.rule}: {item.message}"
        for item in findings
    ]
    lines.append(f"ub check: {file_count} file(s), {len(findings)} error(s)")
    return "\n".join(lines) + "\n"


def _emit_error(fmt: str, root: Path, message: str) -> int:
    if fmt == "json":
        payload = {"root": str(root), "ok": False, "error": message, "findings": []}
        sys.stdout.write(json.dumps(payload, indent=2) + "\n")
    else:
        sys.stderr.write(f"ub check: {message}\n")
    return 2


def main(argv: list[str] | None = None) -> int:
    try:
        mode, raw_paths, fmt = _parse_args(sys.argv[1:] if argv is None else argv)
    except ValueError as exc:
        sys.stderr.write(f"ub check: {exc}\n\n{HELP}")
        return 64
    if mode == "help":
        sys.stdout.write(HELP)
        return 0

    root = Path.cwd().resolve()
    try:
        files = _collect_files(mode, raw_paths, root)
        findings: list[Finding] = []
        for path in files:
            findings.extend(_check_one(path, root))
    except (OSError, RuntimeError, ValueError) as exc:
        return _emit_error(fmt, root, str(exc))

    findings.sort(key=lambda f: (f.file, f.line, f.column, f.rule))
    if fmt == "json":
        payload = {
            "root": str(root),
            "ok": len(findings) == 0,
            "files": len(files),
            "errors": len(findings),
            "findings": [asdict(f) for f in findings],
        }
        sys.stdout.write(json.dumps(payload, indent=2) + "\n")
    else:
        sys.stdout.write(_format_text(findings, len(files)))
    return 1 if findings else 0


if __name__ == "__main__":
    raise SystemExit(main())
