#!/usr/bin/env sh
set -u

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
APP_ROOT="$SCRIPT_DIR"
if [ ! -f "$APP_ROOT/scripts/my-code-x-launcher.mjs" ]; then
  APP_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
fi
NODE_BIN="$APP_ROOT/node/bin/node"

if [ ! -x "$NODE_BIN" ]; then
  NODE_BIN="node"
fi

set +e
"$NODE_BIN" "$APP_ROOT/scripts/my-code-x-launcher.mjs" start "$@"
STATUS=$?
set -e

printf '\nPress Enter to close...'
read -r _

exit "$STATUS"
