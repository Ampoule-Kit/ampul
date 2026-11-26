#!/bin/sh
set -eu

if ! command -v node >/dev/null 2>&1; then
  echo "The uninstaller needs Node.js. Install it from https://nodejs.org" >&2
  exit 1
fi

exec node "$(dirname "$0")/scripts/uninstall.mjs" "$@"
