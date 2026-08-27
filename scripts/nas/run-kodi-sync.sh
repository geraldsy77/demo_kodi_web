#!/bin/sh
set -eu

# Use a predictable PATH when started by DSM Task Scheduler or the API.
PATH=/usr/local/bin:/usr/bin:/bin
export PATH

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
APP_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)

RUN_DIR="$APP_ROOT/run"
LOG_DIR="$APP_ROOT/logs"
LOCK_DIR="$RUN_DIR/kodi-sync.lock"
LOCK_PID_FILE="$LOCK_DIR/pid"
LOG_FILE="$LOG_DIR/kodi-sync.log"
PREVIOUS_LOG_FILE="$LOG_DIR/kodi-sync.log.previous"

NODE_BIN="/usr/local/bin/node"
SYNC_CLI="$APP_ROOT/apps/api/dist/cli/syncKodiSnapshot.js"

MAX_LOG_SIZE_BYTES=5242880
ALREADY_RUNNING_EXIT_CODE=75

mkdir -p "$RUN_DIR" "$LOG_DIR"
umask 077

timestamp() {
  date '+%Y-%m-%dT%H:%M:%S%z'
}

log_message() {
  printf '%s %s\n' "$(timestamp)" "$1" >> "$LOG_FILE"
}

release_lock() {
  if [ -f "$LOCK_PID_FILE" ]; then
    LOCK_PID=$(cat "$LOCK_PID_FILE" 2>/dev/null || true)

    if [ "$LOCK_PID" = "$$" ]; then
      rm -f "$LOCK_PID_FILE"
      rmdir "$LOCK_DIR" 2>/dev/null || true
    fi
  fi
}

handle_hangup() {
  log_message "Synchronization runner received SIGHUP."
  exit 129
}

handle_interrupt() {
  log_message "Synchronization runner received SIGINT."
  exit 130
}

handle_termination() {
  log_message "Synchronization runner received SIGTERM."
  exit 143
}

rotate_log() {
  if [ ! -f "$LOG_FILE" ]; then
    return
  fi

  LOG_SIZE=$(wc -c < "$LOG_FILE")

  case "$LOG_SIZE" in
    ''|*[!0-9]*)
      return
      ;;
  esac

  if [ "$LOG_SIZE" -gt "$MAX_LOG_SIZE_BYTES" ]; then
    rm -f "$PREVIOUS_LOG_FILE"
    mv "$LOG_FILE" "$PREVIOUS_LOG_FILE"
  fi
}

validate_runtime() {
  if [ ! -x "$NODE_BIN" ]; then
    echo "Node.js is not executable at $NODE_BIN." >&2
    exit 1
  fi

  if [ ! -f "$APP_ROOT/.env" ]; then
    echo "Missing $APP_ROOT/.env." >&2
    exit 1
  fi

  if [ ! -f "$SYNC_CLI" ]; then
    echo "Missing compiled synchronization CLI." >&2
    exit 1
  fi

  if ! command -v nice >/dev/null 2>&1; then
    echo "The nice command is required but unavailable." >&2
    exit 1
  fi
}

read_lock_pid() {
  if [ ! -f "$LOCK_PID_FILE" ]; then
    printf '%s' ''
    return
  fi

  cat "$LOCK_PID_FILE" 2>/dev/null || true
}

acquire_lock() {
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    printf '%s\n' "$$" > "$LOCK_PID_FILE"
    return
  fi

  # Another runner may have created the directory but not written its PID yet.
  sleep 1

  EXISTING_PID=$(read_lock_pid)

  # The Express API reserves the lock using its PID before spawning this
  # runner. Because the script is spawned directly, its parent is that API
  # process. Claim the reservation by replacing the parent PID with our PID.
  if [ -n "${PPID:-}" ] && [ "$EXISTING_PID" = "$PPID" ]; then
    printf '%s\n' "$$" > "$LOCK_PID_FILE"
    return
  fi
  case "$EXISTING_PID" in
    ''|*[!0-9]*)
      log_message "Removing synchronization lock with no valid PID."
      rm -f "$LOCK_PID_FILE"
      rmdir "$LOCK_DIR" 2>/dev/null || true
      ;;
    *)
      if kill -0 "$EXISTING_PID" 2>/dev/null; then
        log_message "Synchronization skipped because PID $EXISTING_PID is already running."
        exit "$ALREADY_RUNNING_EXIT_CODE"
      fi

      log_message "Removing stale synchronization lock for PID $EXISTING_PID."
      rm -f "$LOCK_PID_FILE"
      rmdir "$LOCK_DIR" 2>/dev/null || true
      ;;
  esac

  if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    log_message "Synchronization skipped because another process acquired the lock."
    exit "$ALREADY_RUNNING_EXIT_CODE"
  fi

  printf '%s\n' "$$" > "$LOCK_PID_FILE"
}

rotate_log
validate_runtime
acquire_lock

trap release_lock EXIT
trap handle_hangup HUP
trap handle_interrupt INT
trap handle_termination TERM

log_message "KODI snapshot synchronization started."

cd "$APP_ROOT"

set +e
nice -n 10 "$NODE_BIN" "$SYNC_CLI" >> "$LOG_FILE" 2>&1
SYNC_EXIT_CODE=$?
set -e

if [ "$SYNC_EXIT_CODE" -eq 0 ]; then
  log_message "KODI snapshot synchronization completed successfully."
else
  log_message "KODI snapshot synchronization failed with exit code $SYNC_EXIT_CODE."
fi

exit "$SYNC_EXIT_CODE"