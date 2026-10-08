#!/usr/bin/env bash
# Claude Code status line: model · directory · git · context use · rate-limit windows with reset countdowns.
# Claude Code pipes the session as JSON on stdin; see `statusLine` in ~/.claude/settings.json.

input=$(cat)

dim=$'\e[2m'
reset=$'\e[0m'
separator="${dim} · ${reset}"

# Standard ANSI colours, so the terminal's own theme decides the exact shade.
# Thresholds chosen for this status line: under 50% calm, under 80% a warning.
percent() {
  local value=${1%.*}
  local color=$'\e[32m'
  if ((value >= 80)); then color=$'\e[31m'; elif ((value >= 50)); then color=$'\e[33m'; fi
  printf '%s%s%%%s' "$color" "$value" "$reset"
}

countdown() {
  local seconds=$1
  if ((seconds <= 0)); then echo now
  elif ((seconds >= 86400)); then echo "$((seconds / 86400))d$((seconds % 86400 / 3600))h"
  elif ((seconds >= 3600)); then echo "$((seconds / 3600))h$((seconds % 3600 / 60))m"
  else echo "$(((seconds + 59) / 60))m"
  fi
}

# \x1f separates the fields: unlike a tab, read keeps empty ones in place.
IFS=$'\x1f' read -r model dir context five_hour five_hour_reset seven_day seven_day_reset < <(
  jq -r '[
    (.model.display_name // .model.id // ""),
    .workspace.current_dir,
    (.context_window.used_percentage // ""),
    (.rate_limits.five_hour.used_percentage // ""),
    (.rate_limits.five_hour.resets_at // ""),
    (.rate_limits.seven_day.used_percentage // ""),
    (.rate_limits.seven_day.resets_at // "")
  ] | map(tostring) | join("\u001f")' <<<"$input"
)

parts=()

# magpie routes models as "provider/name"; show only the name.
model=${model##*/}
if [[ -n $model ]]; then parts+=("$model"); fi

place=$dir
if [[ $dir == "$HOME" || $dir == "$HOME"/* ]]; then place="~${dir#"$HOME"}"; fi
parts+=("$place")

if status=$(git -C "$dir" --no-optional-locks status --porcelain=v2 --branch 2>/dev/null); then
  branch=$(awk '/^# branch.head /{print $3}' <<<"$status")
  if [[ $branch == "(detached)" ]]; then branch=$(awk '/^# branch.oid /{print substr($3, 1, 7)}' <<<"$status"); fi
  read -r ahead behind < <(awk '/^# branch.ab /{print substr($3, 2), substr($4, 2)}' <<<"$status")
  changed=$(grep -vc '^#' <<<"$status")
  git_part="${dim}⎇${reset} $branch"
  ((${ahead:-0} > 0)) && git_part+=" ↑$ahead"
  ((${behind:-0} > 0)) && git_part+=" ↓$behind"
  ((changed > 0)) && git_part+=" ${dim}●${reset}$changed"
  parts+=("$git_part")
fi

if [[ -n $context ]]; then parts+=("${dim}ctx${reset} $(percent "$context")"); fi

now=$(date +%s)
window() {
  local label=$1 used=$2 resets_at=$3
  [[ -z $used ]] && return
  local text="${dim}${label}${reset} $(percent "$used")"
  [[ -n $resets_at ]] && text+=" ${dim}↻$(countdown $((${resets_at%.*} - now)))${reset}"
  parts+=("$text")
}
window 5h "$five_hour" "$five_hour_reset"
window 7d "$seven_day" "$seven_day_reset"

line=${parts[0]}
for part in "${parts[@]:1}"; do line+="$separator$part"; done
printf '%s\n' "$line"
