#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
APP_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
RUN_DIR="$APP_ROOT/run"
LOG_DIR="$APP_ROOT/logs"
PID_FILE="$RUN_DIR/kodi-web.pid"
LOG_FILE="$LOG_DIR/kodi-web.log"
NODE_BIN=${NODE_BIN:-/usr/local/bin/node}

mkdir -p "$RUN_DIR" "$LOG_DIR"
umask 077

if [ ! -x "$NODE_BIN" ]; then
  echo "Node.js is not executable at $NODE_BIN." >&2
  exit 1
fi
if [ ! -f "$APP_ROOT/.env" ]; then
  echo "Missing $APP_ROOT/.env." >&2
  exit 1
fi
if [ ! -f "$APP_ROOT/apps/api/dist/server.js" ]; then
  echo "Missing compiled API server." >&2
  exit 1
fi
if [ ! -f "$APP_ROOT/apps/web/dist/index.html" ]; then
  echo "Missing compiled web application." >&2
  exit 1
fi

if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  case "$PID" in
    ''|*[!0-9]*) rm -f "$PID_FILE" ;;
    *)
      if kill -0 "$PID" 2>/dev/null; then
        echo "KODI Web is already running with PID $PID."
        exit 0
      fi
      rm -f "$PID_FILE"
      ;;
  esac
fi

if [ -f "$LOG_FILE" ] && [ "$(wc -c < "$LOG_FILE")" -gt 5242880 ]; then
  mv "$LOG_FILE" "$LOG_FILE.previous"
fi

cd "$APP_ROOT"
nohup "$NODE_BIN" apps/api/dist/server.js >> "$LOG_FILE" 2>&1 &
PID=$!
printf '%s\n' "$PID" > "$PID_FILE"
sleep 2

if ! kill -0 "$PID" 2>/dev/null; then
  echo "KODI Web failed to start. Recent log output:" >&2
  tail -n 20 "$LOG_FILE" >&2 || true
  rm -f "$PID_FILE"
  exit 1
fi

echo "KODI Web started with PID $PID."
