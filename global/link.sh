#!/usr/bin/env bash
# Link global/AGENTS.md into every agent's global instruction slot. Idempotent; rerun after cloning on a new machine.
#   bash global/link.sh            link (existing real files are kept as <file>.bak-YYYYMMDD)
#   bash global/link.sh --remove   remove links that point at this file (backups untouched)
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)/AGENTS.md"
TARGETS=(
  "$HOME/.claude/CLAUDE.md"
  "$HOME/.codex/AGENTS.md"
  "$HOME/.config/opencode/AGENTS.md"
  "$HOME/.pi/agent/AGENTS.md"
)
for t in "${TARGETS[@]}"; do
  if [[ "${1:-}" == "--remove" ]]; then
    if [[ -L "$t" && "$(readlink "$t")" == "$SRC" ]]; then rm "$t"; echo "removed $t"; fi
    continue
  fi
  mkdir -p "$(dirname "$t")"
  if [[ -L "$t" ]]; then
    [[ "$(readlink "$t")" == "$SRC" ]] && { echo "ok      $t"; continue; }
    rm "$t"
  elif [[ -e "$t" ]]; then
    cmp -s "$t" "$SRC" || { mv "$t" "$t.bak-$(date +%Y%m%d)"; echo "backup  $t.bak-$(date +%Y%m%d)"; }
    [[ -e "$t" ]] && rm "$t"
  fi
  ln -s "$SRC" "$t"; echo "linked  $t -> $SRC"
done
