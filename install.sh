#!/bin/sh
set -eu

if ! command -v node >/dev/null 2>&1; then
  echo "devenv needs Node.js 26 (the current LTS) or newer, and it is not installed." >&2
  echo "Install it from https://nodejs.org, or with nvm: nvm install 26" >&2
  exit 1
fi

exec node "$(dirname "$0")/scripts/install.mjs" "$@"
