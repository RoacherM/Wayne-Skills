#!/usr/bin/env python3
"""herd_preflight: probe agent CLIs and models before dispatching work.

Supports all local coding CLIs (agy, claude, codex, pi, epi, droid, grok) as well
as custom templates via HERD_PING_CMD. Uses Python subprocess timeouts directly so
it runs cleanly on macOS and Linux without requiring GNU timeout.
"""
import argparse
import os
import re
import shlex
import shutil
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

PROMPT = "Reply with exactly: pong"

CLI_TEMPLATES: dict[str, dict[str, list[str]]] = {
    "agy": {
        "with_model": ["agy", "-p", "{prompt}", "--model", "{model}", "--disable-slash-commands", "--dangerously-skip-permissions"],
        "default": ["agy", "-p", "{prompt}", "--disable-slash-commands", "--dangerously-skip-permissions"],
    },
    "claude": {
        "with_model": ["claude", "-p", "{prompt}", "--model", "{model}", "--no-session-persistence"],
        "default": ["claude", "-p", "{prompt}", "--no-session-persistence"],
    },
    "codex": {
        "with_model": ["codex", "exec", "--ephemeral", "--skip-git-repo-check", "-m", "{model}", "{prompt}"],
        "default": ["codex", "exec", "--ephemeral", "--skip-git-repo-check", "{prompt}"],
    },
    "pi": {
        "with_model": ["pi", "-p", "--no-session", "--no-tools", "--model", "{model}", "{prompt}"],
        "default": ["pi", "-p", "--no-session", "--no-tools", "{prompt}"],
    },
    "epi": {
        "with_model": ["epi", "-p", "--no-session", "--no-tools", "--no-project", "--model", "{model}", "{prompt}"],
        "default": ["epi", "-p", "--no-session", "--no-tools", "--no-project", "{prompt}"],
    },
    "droid": {
        "with_model": ["droid", "exec", "--disable-builtin-skills", "-m", "{model}", "{prompt}"],
        "default": ["droid", "exec", "--disable-builtin-skills", "{prompt}"],
    },
    "grok": {
        "with_model": ["grok", "-p", "{prompt}", "-m", "{model}"],
        "default": ["grok", "-p", "{prompt}"],
    },
}

CLI_ORDER = tuple(CLI_TEMPLATES.keys())

QUOTA_RE = re.compile(
    r"(quota reached|RESOURCE_EXHAUSTED|exhausted your quota"
    r"|usage limit reached|reached your [^\n]*usage limit"
    r"|insufficient_quota|credit balance is too low|API Error:\s*402\b)",
    re.IGNORECASE,
)
CAPACITY_RE = re.compile(r"(no capacity|\b503\b|overloaded_error|service unavailable)", re.IGNORECASE)


def parse_target(spec: str, default_cli: str) -> tuple[str, str | None]:
    """Parse '<cli>:<model>', '<cli>', or '<model>' into (cli, model_or_none)."""
    if ":" in spec:
        head, tail = spec.split(":", 1)
        if head in CLI_TEMPLATES:
            return head, tail or None
    if spec in CLI_TEMPLATES:
        return spec, None
    return default_cli, spec


def build_argv(cli: str, model: str | None, prompt: str, custom_tpl: str | None) -> list[str] | str:
    if custom_tpl:
        target = model if model is not None else cli
        return custom_tpl.replace("{model}", shlex.quote(target)).replace("{prompt}", shlex.quote(prompt))
    spec = CLI_TEMPLATES[cli]
    template = spec["with_model"] if model else spec["default"]
    return [
        part.replace("{prompt}", prompt).replace("{model}", model or "")
        for part in template
    ]


def build_remote_shell(cmd: list[str] | str, cwd: str) -> str:
    if not cwd:
        go = "cd ~"
    elif cwd.startswith("~/"):
        go = f"cd ~/{shlex.quote(cwd[2:])} 2>/dev/null || cd ~"
    else:
        go = f"cd {shlex.quote(cwd)} 2>/dev/null || cd ~"
    cmd_str = cmd if isinstance(cmd, str) else " ".join(shlex.quote(part) for part in cmd)
    return f"{go}; {cmd_str} 2>&1"


def resolve_local_cwd(cwd: str) -> str:
    if not cwd:
        return os.path.expanduser("~")
    expanded = os.path.expanduser(cwd)
    return expanded if os.path.isdir(expanded) else os.path.expanduser("~")


def classify_result(rc: int, out: str, expect: str) -> str:
    if rc == 124:
        return "timeout"
    if rc == 127:
        return "missing"
    if QUOTA_RE.search(out):
        return "quota"
    has_expect = expect.lower() in out.lower()
    if CAPACITY_RE.search(out) and not has_expect:
        return "no-capacity"
    if rc == 0 and has_expect:
        return "ok"
    snippet = " ".join(out.splitlines()).strip()[:120]
    return f"error(rc={rc}): {snippet}"


def execute_probe(machine: str, cmd: list[str] | str, cwd: str, timeout_s: int) -> tuple[int, str]:
    try:
        if machine == "local":
            argv = ["bash", "-c", cmd] if isinstance(cmd, str) else cmd
            run_cwd = resolve_local_cwd(cwd)
        else:
            argv = ["ssh", "-o", "BatchMode=yes", machine, build_remote_shell(cmd, cwd)]
            run_cwd = None
        proc = subprocess.run(
            argv,
            check=False,
            cwd=run_cwd,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            timeout=timeout_s,
        )
        return proc.returncode, proc.stdout
    except subprocess.TimeoutExpired:
        return 124, "timeout"
    except FileNotFoundError as exc:
        return 127, str(exc)


def discover_clis(machine: str) -> list[str]:
    if machine == "local":
        return [cli for cli in CLI_ORDER if shutil.which(cli)]
    probe = "for c in " + " ".join(CLI_ORDER) + "; do command -v \"$c\" >/dev/null 2>&1 && echo \"$c\"; done"
    rc, out = execute_probe(machine, probe, "", 20)
    if rc != 0:
        return []
    found = set(out.split())
    return [cli for cli in CLI_ORDER if cli in found]


def probe_one(
    machine: str,
    spec: str,
    default_cli: str,
    custom_tpl: str | None,
    cwd: str,
    expect: str,
    timeout_s: int,
) -> tuple[str, str]:
    cli, model = parse_target(spec, default_cli)
    cmd = build_argv(cli, model, PROMPT, custom_tpl)
    rc, out = execute_probe(machine, cmd, cwd, timeout_s)
    return spec, classify_result(rc, out, expect)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="herd-preflight",
        description="Ping coding CLIs/models before dispatching work: ok | quota | no-capacity | timeout | missing | error.",
    )
    parser.add_argument("machine", help='target host: "local" or an ssh host alias')
    parser.add_argument("targets", nargs="*", help="targets: <cli>, <cli>:<model>, or <model> (with --cli / HERD_PING_CMD)")
    parser.add_argument("--all", action="store_true", help="discover and ping every installed supported CLI on target machine")
    parser.add_argument("--cli", default=os.environ.get("HERD_DEFAULT_CLI", "agy"), choices=CLI_ORDER, help="default CLI for bare model names (default: agy)")
    parser.add_argument("--timeout", type=int, default=int(os.environ.get("HERD_PING_TIMEOUT", "60")), help="seconds per probe (default: 60)")
    parser.add_argument("--workers", type=int, default=int(os.environ.get("HERD_PING_WORKERS", "4")), help="max concurrent probes (default: 4)")
    return parser


def resolve_targets(args: argparse.Namespace) -> list[str]:
    if args.all:
        discovered = discover_clis(args.machine)
        return discovered + [t for t in args.targets if t not in discovered]
    return list(args.targets)


def main(argv: list[str]) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    targets = resolve_targets(args)
    if not targets:
        sys.stderr.write("herd-preflight: no targets specified (pass <cli[:model]...> or --all)\n")
        return 2
    custom_tpl = os.environ.get("HERD_PING_CMD") or None
    expect = os.environ.get("HERD_PING_EXPECT", "pong")
    cwd = os.environ.get("HERD_PING_CWD", "")
    workers = max(1, min(args.workers, len(targets)))

    if workers == 1:
        results = [probe_one(args.machine, t, args.cli, custom_tpl, cwd, expect, args.timeout) for t in targets]
    else:
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = [pool.submit(probe_one, args.machine, t, args.cli, custom_tpl, cwd, expect, args.timeout) for t in targets]
            results = [fut.result() for fut in futures]

    failed = 0
    for label, status in results:
        if status != "ok":
            failed = 1
        sys.stdout.write(f"{label:<32} {status}\n")
    return failed


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
