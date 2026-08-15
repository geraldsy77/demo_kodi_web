#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
APP_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
PID_FILE="$APP_ROOT/run/kodi-web.pid"

if [ ! -f "$PID_FILE" ]; then
  echo "KODI Web is not running."
  exit 0
fi

PID=$(cat "$PID_FILE")
case "$PID" in
  ''|*[!0-9]*)
    echo "Invalid PID file; refusing to stop a process." >&2
    exit 1
    ;;
esac

if ! kill -0 "$PID" 2>/dev/null; then
  rm -f "$PID_FILE"
  echo "KODI Web was not running; stale PID file removed."
  exit 0
fi

COMMAND=$(tr '\000' ' ' < "/proc/$PID/cmdline" 2>/dev/null || true)
case "$COMMAND" in
  *apps/api/dist/server.js*) ;;
  *)
    echo "PID $PID does not belong to KODI Web; refusing to stop it." >&2
    exit 1
    ;;
esac

kill -TERM "$PID"
COUNT=0
while kill -0 "$PID" 2>/dev/null && [ "$COUNT" -lt 20 ]; do
  sleep 1
  COUNT=$((COUNT + 1))
done

if kill -0 "$PID" 2>/dev/null; then
  echo "KODI Web did not stop within 20 seconds." >&2
  exit 1
fi

rm -f "$PID_FILE"
echo "KODI Web stopped."
