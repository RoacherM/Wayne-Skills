#!/usr/bin/env bash
# Install global/AGENTS.md and global/MEMORY.md into ~/.agents/, then point every agent's global
# instruction slot at ~/.agents/AGENTS.md (Claude Code, Codex, Pi, Factory Droid, Gemini CLI / Antigravity).
# Also copies corrections/README.md to ~/.agents/corrections/README.md. Idempotent; rerun after every edit.
#   bash global/link.sh            install
#   bash global/link.sh --remove   remove the copies and the links that point at AGENTS.md (backups untouched)
set -euo pipefail
GLOBAL_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$GLOBAL_DIR/AGENTS.md"
DEST="$HOME/.agents/AGENTS.md"
MEM_SRC="$GLOBAL_DIR/MEMORY.md"
MEM_DEST="$HOME/.agents/MEMORY.md"
CORR_SRC="$GLOBAL_DIR/corrections/README.md"
CORR_DEST="$HOME/.agents/corrections/README.md"
TARGETS=(
  "$HOME/.claude/CLAUDE.md"
  "$HOME/.codex/AGENTS.md"
  "$HOME/.pi/agent/AGENTS.md"
  "$HOME/.factory/AGENTS.md"
  "$HOME/.gemini/GEMINI.md"
)
if [[ "${1:-}" == "--remove" ]]; then
  for t in "${TARGETS[@]}"; do
    if [[ -L "$t" && "$(readlink "$t")" == "$DEST" ]]; then rm "$t"; echo "removed $t"; fi
  done
  for f in "$DEST" "$MEM_DEST" "$CORR_DEST"; do
    [[ -f "$f" ]] && { rm "$f"; echo "removed $f"; }
  done
  exit 0
fi
mkdir -p "$(dirname "$DEST")" "$(dirname "$CORR_DEST")"
cp "$SRC" "$DEST"; echo "copied  $SRC -> $DEST"
cp "$MEM_SRC" "$MEM_DEST"; echo "copied  $MEM_SRC -> $MEM_DEST"
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
