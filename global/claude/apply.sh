#!/usr/bin/env bash
# Merge the Claude Code settings kept in this repo into ~/.claude/settings.json, and copy statusline.sh.
# Only the keys in global/claude/settings.json change; everything else (magpie's model list, auth, hooks) stays.
# Objects merge recursively, so env keeps its other variables. Idempotent; rerun after every edit.
#   bash global/claude/apply.sh            apply
#   bash global/claude/apply.sh --check    show which keys differ, change nothing
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$HERE/settings.json"
DEST="$HOME/.claude/settings.json"
command -v jq >/dev/null || { echo "jq is required (brew install jq)" >&2; exit 1; }
mkdir -p "$HOME/.claude"
[[ -f "$DEST" ]] || echo '{}' >"$DEST"

merged="$(jq -S --slurpfile repo "$SRC" '. * $repo[0]' "$DEST")"
if [[ "$(jq -S . "$DEST")" == "$merged" ]] && cmp -s "$HERE/statusline.sh" "$HOME/.claude/statusline.sh"; then
  echo "ok      $DEST already matches"; exit 0
fi
if [[ "${1:-}" == "--check" ]]; then
  diff <(jq -S . "$DEST") <(echo "$merged") || true
  cmp -s "$HERE/statusline.sh" "$HOME/.claude/statusline.sh" || echo "statusline.sh differs"
  exit 0
fi

backup="$DEST.bak-$(date +%Y%m%d%H%M%S)"
cp "$DEST" "$backup"; echo "backup  $backup"
jq --slurpfile repo "$SRC" '. * $repo[0]' "$DEST" >"$DEST.tmp" && mv "$DEST.tmp" "$DEST"
echo "merged  $SRC -> $DEST"
cp "$HERE/statusline.sh" "$HOME/.claude/statusline.sh"; chmod +x "$HOME/.claude/statusline.sh"
echo "copied  $HERE/statusline.sh -> $HOME/.claude/statusline.sh"
echo "Restart Claude Code to load the new settings."
