#!/bin/sh
set -eu

APP_DIR="${LUME_APP_DIR:-/home/ubuntu/lume-core}"
DOMAIN="${LUME_DOMAIN:-lumesocial.online}"
MAX_BACKUP_AGE_HOURS="${LUME_MAX_BACKUP_AGE_HOURS:-30}"
MAX_OFFSITE_BACKUP_AGE_HOURS="${LUME_MAX_OFFSITE_BACKUP_AGE_HOURS:-30}"
OFFSITE_REQUIRED="${LUME_OFFSITE_BACKUP_REQUIRED:-true}"
WEBHOOK_URL="${LUME_ALERT_WEBHOOK_URL:-}"

failures=""
add_failure() {
  if [ -n "$failures" ]; then failures="$failures; $1"; else failures="$1"; fi
}

if ! curl -fsS --max-time 12 "https://${DOMAIN}/api/health" >/dev/null; then
  add_failure "HTTPS health check failed"
fi

offsite_status="$APP_DIR/data/backups/.offsite-status.json"
if [ "$OFFSITE_REQUIRED" = "true" ]; then
  if [ ! -f "$offsite_status" ]; then
    add_failure "no external backup status found"
  elif ! grep -q '"status":"success"' "$offsite_status"; then
    add_failure "latest external backup failed"
  else
    offsite_epoch="$(stat -c %Y "$offsite_status" 2>/dev/null || printf '0')"
    offsite_age_hours="$(( ($(date +%s) - offsite_epoch) / 3600 ))"
    if [ "$offsite_age_hours" -gt "$MAX_OFFSITE_BACKUP_AGE_HOURS" ]; then
      add_failure "latest external backup is ${offsite_age_hours}h old"
    fi
  fi
fi

for container in lume-core lume-edge lume-voice; do
  state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container" 2>/dev/null || true)"
  case "$state" in healthy|running) ;; *) add_failure "$container is ${state:-missing}" ;; esac
done

disk_percent="$(df -P "$APP_DIR" | awk 'NR==2 {gsub(/%/, "", $5); print $5}')"
if [ "${disk_percent:-100}" -ge 85 ]; then add_failure "disk usage is ${disk_percent}%"; fi

latest_backup="$(find "$APP_DIR/data/backups" -maxdepth 1 -type f -name '*.db' -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -n 1 || true)"
if [ -z "$latest_backup" ]; then
  add_failure "no database backup found"
else
  backup_epoch="${latest_backup%% *}"
  now_epoch="$(date +%s)"
  age_hours="$(awk -v now="$now_epoch" -v backup="$backup_epoch" 'BEGIN { printf "%d", (now-backup)/3600 }')"
  if [ "$age_hours" -gt "$MAX_BACKUP_AGE_HOURS" ]; then add_failure "latest database backup is ${age_hours}h old"; fi
fi

if [ -z "$failures" ]; then
  logger -t lume-monitor "healthy"
  exit 0
fi

message="Lume production warning: $failures"
logger -p user.err -t lume-monitor "$message"
if [ -n "$WEBHOOK_URL" ]; then
  escaped="$(printf '%s' "$message" | sed 's/\\/\\\\/g; s/"/\\"/g')"
  curl -fsS --max-time 10 -H 'Content-Type: application/json' -d "{\"content\":\"$escaped\"}" "$WEBHOOK_URL" >/dev/null || true
fi
exit 1
