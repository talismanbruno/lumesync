#!/bin/sh
set -eu

APP_DIR="${LUME_APP_DIR:-/home/ubuntu/lume-core}"
BUCKET="${BACKUP_OBJECT_STORAGE_BUCKET:?set BACKUP_OBJECT_STORAGE_BUCKET}"
PREFIX="${BACKUP_OBJECT_STORAGE_PREFIX:-lume-production}"
BACKUP_ID="${1:?usage: restore-object-storage-backup.sh <backup-id> [--apply]}"
MODE="${2:-verify}"

case "$BACKUP_ID" in *[!A-Za-z0-9._-]*|'') echo "Invalid backup id" >&2; exit 2 ;; esac
case "$PREFIX" in /*|*../*|*/..|..) echo "Invalid backup prefix" >&2; exit 2 ;; esac
command -v oci >/dev/null 2>&1 || { echo "OCI CLI is required" >&2; exit 1; }

stage="$APP_DIR/data/restore-staging/$BACKUP_ID"
mkdir -p "$stage"
for item in manifest.json database.db uploads.tar.gz; do
  oci os object get --auth instance_principal --bucket-name "$BUCKET" \
    --name "$PREFIX/backups/$BACKUP_ID/$item" --file "$stage/$item" --force >/dev/null
done

cd "$APP_DIR"
docker compose run --rm --no-deps --entrypoint node lume --import tsx/esm src/scripts/verify-backup-set.ts \
  "/app/data/restore-staging/$BACKUP_ID/manifest.json" \
  "/app/data/restore-staging/$BACKUP_ID/database.db" \
  "/app/data/restore-staging/$BACKUP_ID/uploads.tar.gz"

if [ "$MODE" != "--apply" ]; then
  echo "Verification succeeded. Re-run with --apply only when a restore is actually required."
  exit 0
fi

printf 'This will replace the production database and uploads. Type the backup id to continue: '
read -r confirmation
[ "$confirmation" = "$BACKUP_ID" ] || { echo "Restore cancelled"; exit 1; }

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
rm -rf "data/restore-staging/$BACKUP_ID/extracted"
mkdir -p "data/restore-staging/$BACKUP_ID/extracted"
tar -xzf "$stage/uploads.tar.gz" -C "data/restore-staging/$BACKUP_ID/extracted"
[ -d "data/restore-staging/$BACKUP_ID/extracted/uploads" ] || { echo "Uploads archive is incomplete" >&2; exit 1; }

docker compose stop lume

rollback_db="data/backups/backspace-$timestamp-pre-offsite-restore.db"
rollback_uploads="data/uploads.pre-offsite-restore-$timestamp"
restore_active=true
rollback() {
  [ "$restore_active" = "true" ] || return 0
  echo "Restore did not complete; rolling back automatically." >&2
  rm -rf data/uploads
  if [ -d "$rollback_uploads" ]; then mv "$rollback_uploads" data/uploads; fi
  if [ -f "$rollback_db" ]; then cp "$rollback_db" data/backspace.db; fi
  docker compose up -d --wait lume || true
}
trap rollback EXIT HUP INT TERM

cp data/backspace.db "$rollback_db"
mv data/uploads "$rollback_uploads"
cp "$stage/database.db" data/backspace.db
mv "data/restore-staging/$BACKUP_ID/extracted/uploads" data/uploads
rm -f data/backspace.db-wal data/backspace.db-shm
chown -R 1000:1000 data/backspace.db data/uploads "$rollback_db"

if ! docker compose up -d --wait lume; then
  exit 1
fi

restore_active=false
trap - EXIT HUP INT TERM
echo "Restore completed. Previous data remains at $rollback_db and $rollback_uploads"
