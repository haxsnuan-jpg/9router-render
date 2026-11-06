#!/bin/sh
set -eu

backup_enabled() {
  [ -n "${BACKUP_REPO:-}" ] && [ -n "${BACKUP_TOKEN:-}" ]
}

if backup_enabled; then
  node /app/backup.js restore || echo "[backup] restore failed, continuing with a fresh DB"
fi

node /app/custom-server.js &
APP_PID=$!

if backup_enabled; then
  (
    while sleep "${BACKUP_INTERVAL:-300}"; do
      node /app/backup.js save || true
    done
  ) &
fi

shutdown() {
  if backup_enabled; then node /app/backup.js save || true; fi
  kill "$APP_PID" 2>/dev/null || true
  exit 0
}
trap shutdown TERM INT

wait "$APP_PID"
