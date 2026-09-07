#!/usr/bin/env bash
# Install global/AGENTS.md: copy it to ~/.agents/AGENTS.md (the one global instruction file on this machine),
# then point every agent's own global instruction slot at that copy. Idempotent; rerun after every edit.
#   bash global/link.sh            install
#   bash global/link.sh --remove   remove the copy and the links that point at it (backups untouched)
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)/AGENTS.md"
DEST="$HOME/.agents/AGENTS.md"
TARGETS=(
  "$HOME/.claude/CLAUDE.md"
  "$HOME/.codex/AGENTS.md"
  "$HOME/.config/opencode/AGENTS.md"
  "$HOME/.pi/agent/AGENTS.md"
)
if [[ "${1:-}" == "--remove" ]]; then
  for t in "${TARGETS[@]}"; do
    if [[ -L "$t" && "$(readlink "$t")" == "$DEST" ]]; then rm "$t"; echo "removed $t"; fi
  done
  [[ -f "$DEST" ]] && { rm "$DEST"; echo "removed $DEST"; }
  exit 0
fi
mkdir -p "$(dirname "$DEST")"
cp "$SRC" "$DEST"; echo "copied  $SRC -> $DEST"
for t in "${TARGETS[@]}"; do
  mkdir -p "$(dirname "$t")"
  if [[ -L "$t" ]]; then
    [[ "$(readlink "$t")" == "$DEST" ]] && { echo "ok      $t"; continue; }
    rm "$t"
  elif [[ -e "$t" ]]; then
    cmp -s "$t" "$SRC" || { mv "$t" "$t.bak-$(date +%Y%m%d)"; echo "backup  $t.bak-$(date +%Y%m%d)"; }
    [[ -e "$t" ]] && rm "$t"
  fi
  ln -s "$DEST" "$t"; echo "linked  $t -> $DEST"
done
