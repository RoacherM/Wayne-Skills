#!/usr/bin/env bash
# Install the Nowledge Mem background capture: make sure the nmem CLI works, then load a
# LaunchAgent that runs skills/nowledge-mem/scripts/capture.sh every 10 minutes.
#   bash global/nowledge/apply.sh            install
#   bash global/nowledge/apply.sh --check    report only, change nothing
#   bash global/nowledge/apply.sh --remove   remove the LaunchAgent (log file kept)
set -euo pipefail
NMEM_CLI_VERSION=0.10.112
HERE="$(cd "$(dirname "$0")" && pwd)"
CAPTURE="$(dirname "$(dirname "$HERE")")/skills/nowledge-mem/scripts/capture.sh"
LABEL=com.wayne.nmem-capture
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/nmem-capture.log"
DOMAIN="gui/$(id -u)"
APP_DIRS="${NMEM_APP_DIRS:-/Applications/Nowledge Mem.app:$HOME/Applications/Nowledge Mem.app}"

app_installed() {
  local d
  while IFS= read -r d; do [[ -n "$d" && -d "$d" ]] && return 0; done <<<"${APP_DIRS//:/$'\n'}"
  return 1
}

ensure_nmem() {
  if command -v nmem >/dev/null 2>&1; then
    echo "ok      nmem $(command -v nmem)"
    return 0
  fi
  if app_installed; then
    echo "找到 Nowledge Mem.app 但 nmem 不在 PATH。" >&2
    echo "打开 Nowledge Mem → Settings → Preferences → Developer Tools → Install bundled CLI，然后重跑本脚本" >&2
    exit 1
  fi
  if ! command -v uv >/dev/null 2>&1; then
    echo "本机没有 Nowledge Mem.app 也没有 uv。先装 uv（brew install uv 或 https://docs.astral.sh/uv），再重跑本脚本" >&2
    exit 1
  fi
  uv tool install "nmem-cli==$NMEM_CLI_VERSION"
  hash -r
  if ! command -v nmem >/dev/null 2>&1; then
    echo "uv 装好了 nmem-cli 但 nmem 还不在 PATH；把 ~/.local/bin 加进 PATH 后重跑" >&2
    exit 1
  fi
  echo "installed nmem-cli==$NMEM_CLI_VERSION via uv"
}

write_plist() {
  mkdir -p "$(dirname "$PLIST")" "$(dirname "$LOG")"
  cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>$LABEL</string>
	<key>ProgramArguments</key>
	<array>
		<string>/bin/bash</string>
		<string>$CAPTURE</string>
	</array>
	<key>StartInterval</key>
	<integer>600</integer>
	<key>RunAtLoad</key>
	<true/>
	<key>EnvironmentVariables</key>
	<dict>
		<key>PATH</key>
		<string>/usr/local/bin:/opt/homebrew/bin:$HOME/.local/bin:/usr/bin:/bin</string>
	</dict>
	<key>StandardOutPath</key>
	<string>$LOG</string>
	<key>StandardErrorPath</key>
	<string>$LOG</string>
</dict>
</plist>
EOF
}

case "${1:-install}" in
  --check)
    if command -v nmem >/dev/null 2>&1; then
      echo "nmem    $(command -v nmem) ($(nmem --version 2>/dev/null | head -n 1))"
    else
      echo "nmem    not on PATH"
    fi
    if nmem doctor >/dev/null 2>&1; then echo "doctor  ok"; else echo "doctor  failed"; fi
    if [[ -f "$PLIST" ]]; then echo "plist   $PLIST"; else echo "plist   missing ($PLIST)"; fi
    if launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1; then echo "job     loaded"; else echo "job     not loaded"; fi
    echo "log     $LOG"
    tail -n 5 "$LOG" 2>/dev/null || echo "        (no log yet)"
    ;;
  --remove)
    launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
    if [[ -f "$PLIST" ]]; then rm "$PLIST"; echo "removed $PLIST"; else echo "no plist $PLIST"; fi
    ;;
  install)
    ensure_nmem
    if ! nmem doctor; then
      echo "nmem doctor 没过；跑 nmem connect <连接链接> 连上 Mem 服务后重跑本脚本" >&2
      exit 1
    fi
    write_plist
    echo "wrote   $PLIST"
    launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
    launchctl bootstrap "$DOMAIN" "$PLIST"
    echo "loaded  $LABEL (every 600s; log: $LOG)"
    ;;
  *)
    echo "usage: apply.sh [--check|--remove]" >&2
    exit 1
    ;;
esac
