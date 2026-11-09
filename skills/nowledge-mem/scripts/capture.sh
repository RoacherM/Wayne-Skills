#!/usr/bin/env bash
# Sync conversations from every local coding agent into Nowledge Mem.
# Run by ~/Library/LaunchAgents/com.wayne.nmem-capture.plist every 10 minutes;
# stdout/stderr go to ~/Library/Logs/nmem-capture.log. Always exits 0: a failing
# source is logged and skipped so one bad tool never blocks the rest.
set -u
SOURCES=(claude-code codex pi grok devin antigravity)

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

if ! command -v nmem >/dev/null 2>&1; then
  log "nmem not on PATH; skipped"
  exit 0
fi

for src in "${SOURCES[@]}"; do
  if out="$(nmem t sync --from "$src" --all-projects --limit 20 --apply 2>&1)"; then
    log "$src ok"
  else
    rc=$?
    log "$src failed (exit $rc): $(printf '%s' "$out" | tail -n 1)"
  fi
done
exit 0
