#!/usr/bin/env python3
"""herd-watchd: poll a herd board, wake @mentioned workers, alert coordinator safely.

Supports both Herdr.app (`hc`) and legacy terminal `herdr` backends.
By default, coordinator notifications use `mode: "notify"` (append to alerts.jsonl
+ optional HERD_NOTIFY_CMD) so the watcher NEVER clobbers text being typed in the
user's interactive Herdr.app pane. Set `coordinator.mode: "unattended"` only for a
dedicated unattended coordinator pane.

Environment:
  HERD_BOARD_HOST   ssh host storing the board; empty or "local" = this machine
  HERD_ROOT         where bare project names live on the board host (default ~/herd)
  HERD_REMOTE_BIN   directory holding herd-read on the board host
  HERD_INTERVAL     seconds between polls (default 20)
  HERD_DENY_PANES   comma-separated pane/terminal/agent names never to prompt
  HERD_QUOTA_RE     regex marking "quota exhausted" in a member's pane
  HERD_LANG         prompt language: en (default) or zh
  HERD_BACKEND      transport backend: auto (default), hc, or herdr
  HERD_HC_BIN       hc binary path (default: hc)
  HERD_HERDR_BIN    legacy herdr binary (default: $HERDR_BIN_PATH or herdr)
  HERD_COORD_MODE   override roster coordinator.mode: notify | unattended
  HERD_NOTIFY_CMD   optional local shell command run on coordinator notify; receives
                    HERD_ALERT_KEY, HERD_ALERT_KIND, HERD_ALERT_TEXT in env
"""
import argparse
import datetime
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import time

DEFAULT_QUOTA_RE = (
    r"(quota reached|RESOURCE_EXHAUSTED|exhausted your quota"
    r"|usage limit reached|reached your [^\n]*usage limit"
    r"|insufficient_quota|credit balance is too low|API Error:\s*402\b)"
)
REWORK_RE = re.compile(r"(\[rework\]|\bfailed:|打回|重做|\brejected\b)", re.IGNORECASE)

MESSAGES = {
    "en": {
        "wake": "[board] #{seq} from {agent}: {text}. Read the board with herd-read.",
        "deadline": "[herd-watch] Deadline {dl} reached. Accept what exists now (herd-read shows the board).",
        "stall": "[herd-watch] No new post for {sm} minutes; still without [done]: {names}. Please check.",
        "quota": "[herd-watch] Member {name}'s pane shows a quota message: {line}. Switch to the fallback model.",
    },
    "zh": {
        "wake": "[board] #{seq} 来自 {agent}：{text}。请用 herd-read 读公告板",
        "deadline": "[herd-watch] 已到截止时间 {dl}。请按现有产物验收收卷（herd-read 看公告板）。",
        "stall": "[herd-watch] 公告板已 {sm} 分钟无新帖，未交 [done]：{names}。请检查。",
        "quota": "[herd-watch] 成员 {name} 窗格出现额度耗尽字样：{line}。请换备用模型。",
    },
}


class WatchConfig:
    """Immutable runtime settings loaded once from environment and CLI args."""

    def __init__(self, project: str, run_mode: str, cycle_mode: str) -> None:
        self.host = os.environ.get("HERD_BOARD_HOST", "").strip()
        self.is_local = self.host in ("", "local")
        self.root = os.environ.get("HERD_ROOT", "~/herd")
        self.interval = int(os.environ.get("HERD_INTERVAL", "20"))
        self.deny = {s.strip() for s in os.environ.get("HERD_DENY_PANES", "").split(",") if s.strip()}
        self.quota_re = re.compile(os.environ.get("HERD_QUOTA_RE", DEFAULT_QUOTA_RE), re.IGNORECASE)
        self.lang = os.environ.get("HERD_LANG", "en").lower()[:2]
        self.msg = MESSAGES.get(self.lang)
        self.hc_bin = os.environ.get("HERD_HC_BIN") or "hc"
        self.herdr_bin = os.environ.get("HERD_HERDR_BIN") or os.environ.get("HERDR_BIN_PATH") or "herdr"
        self.backend = detect_backend(self.hc_bin)
        self.coord_mode_override = os.environ.get("HERD_COORD_MODE", "").strip().lower()
        self.notify_cmd = os.environ.get("HERD_NOTIFY_CMD", "").strip()
        self.run_mode = run_mode        # "live" | "dry_run"
        self.cycle_mode = cycle_mode    # "loop" | "once"
        self.path = resolve_board_path(project, self.root, self.host)
        self.quoted_path = shlex.quote(self.path)
        self.quoted_read = shlex.quote(resolve_read_bin(self.root, self.host))


def is_local_host(host: str) -> bool:
    return host in ("", "local")


def detect_backend(hc_bin: str) -> str:
    explicit = os.environ.get("HERD_BACKEND", "auto").strip().lower()
    if explicit in ("hc", "herdr"):
        return explicit
    if os.environ.get("HERD_HC_BIN"):
        return "hc"
    if os.environ.get("HERD_HERDR_BIN"):
        return "herdr"
    if os.environ.get("HC_TERMINAL_ID"):
        return "hc"
    if os.environ.get("HERDR_ENV") == "1":
        return "herdr"
    return "hc" if shutil.which(hc_bin) else "herdr"


def resolve_board_path(project: str, root: str, host: str) -> str:
    if not (project.startswith(("/", "~", "./", "../")) or project == "."):
        project = root.rstrip("/") + "/" + project
    if is_local_host(host):
        return os.path.abspath(os.path.expanduser(project))
    if project == "~":
        return "."
    return "./" + project[2:] if project.startswith("~/") else project


def resolve_read_bin(root: str, host: str) -> str:
    local = is_local_host(host)
    default_dir = os.path.dirname(os.path.abspath(__file__)) if local else root.rstrip("/") + "/bin"
    rbin = os.environ.get("HERD_REMOTE_BIN") or default_dir
    if local:
        rbin = os.path.abspath(os.path.expanduser(rbin))
    elif rbin.startswith("~/"):
        rbin = "./" + rbin[2:]
    return rbin.rstrip("/") + "/herd-read"


def utc_now() -> datetime.datetime:
    return datetime.datetime.now(datetime.UTC)


def parse_time(raw: str) -> datetime.datetime:
    return datetime.datetime.fromisoformat(raw)


def run_cmd(argv: list[str], inp: str | None = None, timeout: int = 60, cwd: str | None = None, env: dict[str, str] | None = None) -> tuple[int, str, str]:
    try:
        proc = subprocess.run(argv, check=False, input=inp, capture_output=True, text=True, timeout=timeout, cwd=cwd, env=env)
        return proc.returncode, proc.stdout, proc.stderr
    except subprocess.TimeoutExpired:
        return 124, "", "timeout"
    except FileNotFoundError as exc:
        return 127, "", str(exc)


def board_exec(cfg: WatchConfig, cmd: str, inp: str | None = None, timeout: int = 60) -> tuple[int, str, str]:
    if cfg.is_local:
        return run_cmd(["bash", "-c", cmd], inp=inp, timeout=timeout, cwd=os.path.expanduser("~"))
    return run_cmd(["ssh", "-o", "BatchMode=yes", cfg.host, cmd], inp=inp, timeout=timeout)


def hc_address(machine: str | None, target: str) -> str:
    if machine in (None, "", "local") or "/" in target:
        return target
    return f"{machine}/{target}"


def parse_hc_status(out: str) -> str:
    try:
        data = json.loads(out)
    except json.JSONDecodeError:
        return "unknown"
    if data.get("state") == "exited":
        return "exited"
    status = data.get("status")
    if isinstance(status, dict) and status.get("state"):
        return str(status["state"])
    if isinstance(status, str) and status:
        return status
    return "idle"


def parse_herdr_status(out: str) -> str:
    try:
        res = json.loads(out)["result"]
        agent = res.get("agent", res)
        return str(agent.get("agent_status", "unknown"))
    except (json.JSONDecodeError, KeyError, TypeError, AttributeError):
        return "unknown"


def get_agent_status(cfg: WatchConfig, machine: str | None, target: str) -> str:
    if cfg.backend == "hc":
        rc, out, _ = run_cmd([cfg.hc_bin, "get", "--json", hc_address(machine, target)], timeout=30)
        return "missing" if rc != 0 else parse_hc_status(out)
    prefix = [cfg.herdr_bin] + ([] if machine in (None, "", "local") else ["--machine", machine])
    rc, out, _ = run_cmd(prefix + ["agent", "get", target], timeout=30)
    return "missing" if rc != 0 else parse_herdr_status(out)


def dispatch_prompt(cfg: WatchConfig, machine: str | None, target: str, text: str) -> tuple[int, str, str]:
    if cfg.backend == "hc":
        # Strip HC_TERMINAL_ID so hc send does not wrap [board] wakes in <hc from="<coordinator>">
        send_env = {k: v for k, v in os.environ.items() if k != "HC_TERMINAL_ID"}
        return run_cmd([cfg.hc_bin, "send", hc_address(machine, target), text], timeout=90, env=send_env)
    prefix = [cfg.herdr_bin] + ([] if machine in (None, "", "local") else ["--machine", machine])
    return run_cmd(prefix + ["agent", "prompt", target, text], timeout=90)


def send_prompt(cfg: WatchConfig, machine: str | None, target: str, text: str) -> str:
    """Return 'ok', 'denied', 'blocked', 'missing', 'exited', or 'err:...'."""
    if not target:
        return "missing"
    if target in cfg.deny:
        return "denied"
    if cfg.run_mode == "dry_run":
        return "dry"
    st = get_agent_status(cfg, machine, target)
    if st in ("blocked", "missing", "exited"):
        return st
    rc, out, err = dispatch_prompt(cfg, machine, target, text)
    return "ok" if rc == 0 else f"err:{(err or out)[:150]}"


def read_pane_text(cfg: WatchConfig, machine: str | None, target: str) -> str | None:
    if cfg.backend == "hc":
        addr = hc_address(machine, target)
        rc, out, _ = run_cmd([cfg.hc_bin, "read", "--lines", "60", addr], timeout=30)
        if rc != 0:
            rc, out, _ = run_cmd([cfg.hc_bin, "read", "--lines", "0", addr], timeout=30)
        return out if rc == 0 else None
    prefix = [cfg.herdr_bin] + ([] if machine in (None, "", "local") else ["--machine", machine])
    rc, out, _ = run_cmd(prefix + ["agent", "read", target, "--source", "recent-unwrapped", "--lines", "60"], timeout=30)
    if rc != 0:
        rc, out, _ = run_cmd(prefix + ["agent", "read", target, "--source", "visible"], timeout=30)
    return out if rc == 0 else None


def load_board_json(cfg: WatchConfig, name: str) -> dict | None:
    rc, out, _ = board_exec(cfg, f"cat {cfg.quoted_path}/{name} 2>/dev/null")
    if rc != 0 or not out.strip():
        return None
    try:
        parsed = json.loads(out)
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def save_state(cfg: WatchConfig, state: dict) -> None:
    payload = json.dumps(state, ensure_ascii=False)
    cmd = f"cat > {cfg.quoted_path}/watch.state.json.tmp && mv {cfg.quoted_path}/watch.state.json.tmp {cfg.quoted_path}/watch.state.json"
    board_exec(cfg, cmd, inp=payload)


def flush_logs(cfg: WatchConfig, lines: list[str]) -> None:
    if not lines:
        return
    blob = "".join(lines)
    board_exec(cfg, f"cat >> {cfg.quoted_path}/watch.log", inp=blob)
    if cfg.run_mode == "dry_run":
        sys.stdout.write(blob)
    lines.clear()


def append_alert_record(cfg: WatchConfig, kind: str, key: str, text: str) -> None:
    rec = {
        "time": utc_now().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "kind": kind,
        "key": key,
        "text": text,
    }
    line = json.dumps(rec, ensure_ascii=False) + "\n"
    board_exec(cfg, f"cat >> {cfg.quoted_path}/alerts.jsonl", inp=line)
    if cfg.notify_cmd and cfg.run_mode == "live":
        env = dict(os.environ, HERD_ALERT_KEY=key, HERD_ALERT_KIND=kind, HERD_ALERT_TEXT=text)
        run_cmd(["bash", "-c", cfg.notify_cmd], timeout=15, env=env)


def find_mentions(text: str, names: set[str] | dict) -> set[str]:
    """Match word-initial @name (case-insensitive). @all = all; @fix wakes fix-1, fix-2..."""
    found: set[str] = set()
    all_names = list(names)
    for match in re.finditer(r"(?<![A-Za-z0-9_-])@([A-Za-z0-9_-]+)", text):
        token = match.group(1).lower()
        if token == "all":
            found.update(all_names)
            continue
        group_re = re.compile(re.escape(token) + r"-\d+")
        for member in all_names:
            low = member.lower()
            if low == token or group_re.fullmatch(low):
                found.add(member)
    return found


def compute_done_members(posts: list[dict], members: dict) -> set[str]:
    """Track each member's current [done] state, revoking when a later post rejects/reworks them."""
    done: set[str] = set()
    for post in posts:
        author = post.get("agent", "")
        text = post.get("text", "")
        low = text.lower()
        if "[done]" in low and author:
            done.add(author)
        if REWORK_RE.search(text):
            for target in find_mentions(text, members):
                if target != author:
                    done.discard(target)
    return done


def coordinator_mode(cfg: WatchConfig, coord: dict) -> str:
    if cfg.coord_mode_override in ("notify", "unattended"):
        return cfg.coord_mode_override
    raw = str(coord.get("mode", "notify")).strip().lower()
    return "unattended" if raw == "unattended" else "notify"


def deliver_to_coordinator(cfg: WatchConfig, coord: dict, kind: str, key: str, text: str, logs: list[str]) -> str:
    mode = coordinator_mode(cfg, coord)
    if mode == "notify":
        if cfg.run_mode == "dry_run":
            logs.append(format_log(f"DRY would notify coordinator ({kind} {key}): {text}"))
            return "ok"
        append_alert_record(cfg, kind, key, text)
        logs.append(format_log(f"NOTIFY coordinator {kind}:{key}"))
        return "ok"
    res = send_prompt(cfg, coord.get("machine"), coord.get("pane", ""), text)
    if res == "dry":
        logs.append(format_log(f"DRY would prompt {coord.get('machine') or 'local'}:{coord.get('pane')}: {text}"))
        return "ok"
    if res == "denied":
        logs.append(format_log(f"DENY refuse prompt to {coord.get('pane')}"))
    return res


def format_log(msg: str) -> str:
    return f"{utc_now():%Y-%m-%dT%H:%M:%SZ} {msg}\n"


def notify_member(cfg: WatchConfig, name: str, post: dict, members: dict, coord: dict, logs: list[str]) -> str:
    msg = cfg.msg["wake"].format(seq=post["seq"], agent=post["agent"], text=post["text"][:80])
    if name == "coordinator":
        return deliver_to_coordinator(cfg, coord, "mention", f"#{post['seq']}", msg, logs)
    member = members[name]
    target = member.get("agent", name)
    res = send_prompt(cfg, member.get("machine"), target, msg)
    if res == "dry":
        logs.append(format_log(f"DRY would prompt {member.get('machine') or 'local'}:{target}: {msg}"))
        return "ok"
    if res == "denied":
        logs.append(format_log(f"DENY refuse prompt to {target}"))
    return res


def process_mentions(cfg: WatchConfig, posts: list[dict], members: dict, coord: dict, state: dict, logs: list[str]) -> None:
    notified = state.setdefault("notified", {})
    blocked_logged = state.setdefault("blocked_logged", {})
    cursor = state.get("cursor", 0)
    for post in posts:
        if post["seq"] <= cursor:
            continue
        for name in sorted(find_mentions(post["text"], members)):
            key = f"{post['seq']}:{name}"
            if name == post["agent"] or key in notified:
                continue
            res = notify_member(cfg, name, post, members, coord, logs)
            record_delivery(name, post["seq"], key, res, notified, blocked_logged, logs)
    pending = [int(k.split(":")[0]) for k in blocked_logged if k not in notified]
    top = posts[-1]["seq"] if posts else 0
    state["cursor"] = (min(pending) - 1) if pending else top


def record_delivery(name: str, seq: int, key: str, res: str, notified: dict, blocked_logged: dict, logs: list[str]) -> None:
    if res == "ok":
        notified[key] = 1
        logs.append(format_log(f"WAKE {name} for #{seq}"))
    elif res == "blocked":
        if key not in blocked_logged:
            blocked_logged[key] = 1
            logs.append(format_log(f"SKIP {name} blocked, #{seq} pending"))
    else:
        logs.append(format_log(f"FAIL wake {name} #{seq}: {res}"))


def fire_alert(cfg: WatchConfig, coord: dict, alerts: dict, kind: str, key: str, text: str, logs: list[str]) -> None:
    if key in alerts:
        return
    res = deliver_to_coordinator(cfg, coord, kind, key, text, logs)
    if res == "ok":
        alerts[key] = 1
        logs.append(format_log(f"ALERT coordinator {key}"))
    elif res == "blocked":
        if f"b:{key}" not in alerts:
            logs.append(format_log(f"ALERT {key} deferred: coordinator blocked"))
        alerts[f"b:{key}"] = 1
    else:
        logs.append(format_log(f"ALERT {key} fail: {res}"))


def check_deadline(cfg: WatchConfig, roster: dict, coord: dict, alerts: dict, logs: list[str]) -> None:
    dl = roster.get("deadline_utc")
    if not dl:
        return
    try:
        if utc_now() >= parse_time(dl):
            fire_alert(cfg, coord, alerts, "deadline", "deadline", cfg.msg["deadline"].format(dl=dl), logs)
    except ValueError as exc:
        logs.append(format_log(f"WARN bad deadline {dl}: {exc}"))


def check_stall(cfg: WatchConfig, roster: dict, members: dict, coord: dict, posts: list[dict], state: dict, logs: list[str]) -> None:
    stall_min = roster.get("stall_minutes")
    if not stall_min:
        return
    done = compute_done_members(posts, members)
    notdone = [n for n, m in members.items() if n not in done and not m.get("wake_only")]
    if not notdone:
        return
    ref = state.get("last_post_time") or state.setdefault("started", f"{utc_now():%Y-%m-%dT%H:%M:%SZ}")
    if (utc_now() - parse_time(ref)).total_seconds() > stall_min * 60:
        key = f"stall:{state.get('last_seq', 0)}"
        text = cfg.msg["stall"].format(sm=stall_min, names=", ".join(notdone))
        fire_alert(cfg, coord, state.setdefault("alerts", {}), "stall", key, text, logs)


def find_quota_hit(cfg: WatchConfig, text: str) -> str | None:
    hits = [
        line for line in text.splitlines()
        if cfg.quota_re.search(line) and "[board]" not in line and "[herd-watch]" not in line
    ]
    return hits[-1].strip()[:100] if hits else None


def check_quota(cfg: WatchConfig, members: dict, coord: dict, state: dict, logs: list[str]) -> None:
    if cfg.run_mode == "dry_run":
        return
    alerts = state.setdefault("alerts", {})
    for name, member in members.items():
        key = f"quota:{name}"
        if member.get("wake_only") or key in alerts:
            continue
        out = read_pane_text(cfg, member.get("machine"), member.get("agent", name))
        hit = find_quota_hit(cfg, out) if out is not None else None
        if hit:
            fire_alert(cfg, coord, alerts, "quota", key, cfg.msg["quota"].format(name=name, line=hit), logs)


def tick(cfg: WatchConfig, state: dict, logs: list[str]) -> None:
    roster = load_board_json(cfg, "roster.json")
    if not roster:
        logs.append(format_log("WARN roster.json missing/invalid"))
        return
    coord = roster.get("coordinator", {})
    members = dict(roster.get("members", {}))
    if coord.get("pane") or coordinator_mode(cfg, coord) == "notify":
        members.setdefault("coordinator", {"machine": coord.get("machine"), "agent": coord.get("pane", ""), "wake_only": True})

    rc, out, err = board_exec(cfg, f"{cfg.quoted_read} {cfg.quoted_path} --json")
    if rc != 0:
        logs.append(format_log(f"WARN herd-read failed rc={rc} {err[:100]}"))
        return
    posts = [json.loads(line) for line in out.splitlines() if line.strip()]

    process_mentions(cfg, posts, members, coord, state, logs)
    if posts and posts[-1]["seq"] != state.get("last_seq"):
        state["last_seq"] = posts[-1]["seq"]
        state["last_post_time"] = posts[-1]["time"]

    check_deadline(cfg, roster, coord, state.setdefault("alerts", {}), logs)
    check_stall(cfg, roster, members, coord, posts, state, logs)
    check_quota(cfg, members, coord, state, logs)


def parse_cli(argv: list[str]) -> argparse.Namespace:
    ap = argparse.ArgumentParser(
        prog="herd-watchd.py",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        description=(__doc__ or "").split("\n\n")[0],
        epilog=(__doc__ or "").split("\n\n", 2)[-1],
    )
    ap.add_argument("project", help="project directory on the board host, or a bare name under $HERD_ROOT")
    ap.add_argument("--once", action="store_true", help="run a single poll and exit")
    ap.add_argument("--dry-run", action="store_true", help="log actions without calling hc/herdr or writing alerts")
    ap.add_argument("--print-path", action="store_true", help="print the resolved project path on the board host and exit")
    return ap.parse_args(argv)


def startup_banner(cfg: WatchConfig) -> str:
    flags = (" dry-run" if cfg.run_mode == "dry_run" else "") + (" once" if cfg.cycle_mode == "once" else "")
    board_name = "local" if cfg.is_local else cfg.host
    return format_log(
        f"START pid={os.getpid()} backend={cfg.backend} interval={cfg.interval}s "
        f"board={board_name} deny={sorted(cfg.deny)}{flags}"
    )


def run_watch_loop(cfg: WatchConfig, state: dict, logs: list[str]) -> None:
    while True:
        try:
            tick(cfg, state, logs)
            save_state(cfg, state)
        except (OSError, json.JSONDecodeError, ValueError, KeyError, TypeError) as exc:
            logs.append(format_log(f"ERROR {type(exc).__name__}: {exc}"))
        flush_logs(cfg, logs)
        if cfg.cycle_mode == "once":
            return
        time.sleep(cfg.interval)


def main(argv: list[str] | None = None) -> int:
    args = parse_cli(sys.argv[1:] if argv is None else argv)
    cfg = WatchConfig(args.project, "dry_run" if args.dry_run else "live", "once" if args.once else "loop")
    if not cfg.msg:
        sys.stderr.write(f"herd-watchd.py: HERD_LANG={cfg.lang!r} is not supported (use en or zh)\n")
        return 2
    if args.print_path:
        sys.stdout.write(cfg.path + "\n")
        return 0
    logs = [startup_banner(cfg)]
    flush_logs(cfg, logs)
    state = load_board_json(cfg, "watch.state.json") or {}
    run_watch_loop(cfg, state, logs)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
