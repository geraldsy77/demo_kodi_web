#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
APP_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
PID_FILE="$APP_ROOT/run/kodi-web.pid"
HEALTH_URL=${KODI_HEALTH_URL:-http://127.0.0.1:8181/api/health}

if [ ! -f "$PID_FILE" ]; then
  echo "KODI Web is stopped."
  exit 1
fi

PID=$(cat "$PID_FILE")
case "$PID" in
  ''|*[!0-9]*)
    echo "KODI Web has an invalid PID file."
    exit 1
    ;;
esac

if ! kill -0 "$PID" 2>/dev/null; then
  echo "KODI Web is stopped (stale PID $PID)."
  exit 1
fi

echo "KODI Web is running with PID $PID."
if command -v curl >/dev/null 2>&1; then
  curl --fail --silent --show-error "$HEALTH_URL"
  printf '\n'
fi
