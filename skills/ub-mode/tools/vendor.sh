#!/usr/bin/env bash
# Refresh the vendored copies of crapper, dryer and mutator from upstream main and rewrite the commit pins in VENDOR.
#   bash skills/ub-mode/tools/vendor.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
head="$(sed -n '1,/^$/p' "$HERE/VENDOR")"
pins=""
for r in crapper dryer mutator; do
  git clone -q --depth 1 "https://github.com/unclebob/$r" "$TMP/$r"
  rm -rf "${HERE:?}/$r"
  mkdir -p "$HERE/$r"
  git -C "$TMP/$r" archive HEAD src LICENSE README.md pyproject.toml | tar -x -C "$HERE/$r"
  pins+="$(printf '%-8s https://github.com/unclebob/%-8s %s  %s' "$r" "$r" \
    "$(git -C "$TMP/$r" rev-parse HEAD)" "$(git -C "$TMP/$r" log -1 --format=%cs)")"$'\n'
done
printf '%s\n\n%s' "$head" "$pins" >"$HERE/VENDOR"
cat "$HERE/VENDOR"
