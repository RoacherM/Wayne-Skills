#!/usr/bin/env bash
# Install global/AGENTS.md: copy it to ~/.agents/AGENTS.md (the one global instruction file on this machine),
# then point every agent's own global instruction slot at that copy. Also copies corrections/README.md, which
# AGENTS.md refers to, to ~/.agents/corrections/README.md. Idempotent; rerun after every edit.
#   bash global/link.sh            install
#   bash global/link.sh --remove   remove the copy and the links that point at it (backups untouched)
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)/AGENTS.md"
DEST="$HOME/.agents/AGENTS.md"
CORR_SRC="$(dirname "$SRC")/corrections/README.md"
CORR_DEST="$HOME/.agents/corrections/README.md"
TARGETS=(
  "$HOME/.claude/CLAUDE.md"
  "$HOME/.codex/AGENTS.md"
  "$HOME/.pi/agent/AGENTS.md"
)
if [[ "${1:-}" == "--remove" ]]; then
  for t in "${TARGETS[@]}"; do
    if [[ -L "$t" && "$(readlink "$t")" == "$DEST" ]]; then rm "$t"; echo "removed $t"; fi
  done
  [[ -f "$DEST" ]] && { rm "$DEST"; echo "removed $DEST"; }
  [[ -f "$CORR_DEST" ]] && { rm "$CORR_DEST"; echo "removed $CORR_DEST"; }
  exit 0
fi
mkdir -p "$(dirname "$DEST")"
cp "$SRC" "$DEST"; echo "copied  $SRC -> $DEST"
mkdir -p "$(dirname "$CORR_DEST")"
cp "$CORR_SRC" "$CORR_DEST"; echo "copied  $CORR_SRC -> $CORR_DEST"
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
