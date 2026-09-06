#!/bin/sh
set -eu

# Promote a reviewed, immutable Lume container on the Oracle host. The database,
# uploads and independently promoted web-dist bind mount are never replaced.
image="${1:?container image is required}"
release_id="${2:?release id is required}"
commit="${3:?full source commit is required}"
app_dir="${LUME_APP_DIR:-/home/ubuntu/lume-core}"

case "$image" in
  ghcr.io/talismanbruno/lumesync:*) ;;
  *) echo "Refusing unexpected image: $image" >&2; exit 2 ;;
esac
case "$release_id" in
  ''|*[!A-Za-z0-9._-]*) echo "Invalid release id" >&2; exit 2 ;;
esac
case "$commit" in
  *[!0-9a-f]*|'') echo "Invalid source commit" >&2; exit 2 ;;
esac

cd "$app_dir"
test "$(pwd -P)" = "$app_dir"
test -s .env
test -s compose.yml
test -s data/backspace.db
docker inspect lume-core >/dev/null

old_image_id="$(docker inspect --format '{{.Image}}' lume-core)"
rollback_image="lume/rollback:$release_id"
env_backup=".env.pre-$release_id"
compose_backup="compose.yml.pre-$release_id"
next_compose="compose.yml.next-$release_id"
rollback_override="compose.rollback-$release_id.yml"

test ! -e "$env_backup"
test ! -e "$compose_backup"
test ! -e "$next_compose"
cp .env "$env_backup"
cp compose.yml "$compose_backup"
docker image tag "$old_image_id" "$rollback_image"

# VACUUM INTO produces a consistent snapshot while the live server is running.
docker exec -w /app/packages/server lume-core \
  node --import tsx/esm src/scripts/snapshot.ts

docker pull "$image"

upsert_env() {
  key="$1"
  value="$2"
  if grep -q "^${key}=" .env; then
    sed -i "s#^${key}=.*#${key}=${value}#" .env
  else
    printf '%s=%s\n' "$key" "$value" >> .env
  fi
}

rollback() {
  code="$?"
  trap - EXIT INT TERM
  set +e
  echo "Promotion failed; restoring the previous image and configuration." >&2
  cp "$env_backup" .env
  cp "$compose_backup" compose.yml
  printf 'services:\n  lume:\n    image: %s\n' "$rollback_image" > "$rollback_override"
  docker compose -f compose.yml -f "$rollback_override" up -d --no-deps --no-build lume
  for _ in $(seq 1 30); do
    rollback_status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' lume-core 2>/dev/null || true)"
    [ "$rollback_status" = healthy ] && break
    sleep 5
  done
  [ "$rollback_status" = healthy ] || docker logs --tail 100 lume-core || true
  rm -f "$rollback_override" "$next_compose"
  exit "$code"
}
trap rollback EXIT INT TERM

upsert_env BACKSPACE_COMMIT "$commit"
upsert_env BACKSPACE_SOURCE_URL "https://github.com/talismanbruno/lumesync/tree/$commit"

# Rewrite only the image field inside the lume service. Building is disabled:
# production must run the exact image already scanned and published by CI.
awk -v image="$image" '
  /^  lume:/ { in_lume = 1 }
  in_lume && /^    image:/ && !done { print "    image: " image; done = 1; next }
  in_lume && /^  [A-Za-z0-9_-]+:/ { in_lume = 0 }
  { print }
  END { if (!done) exit 42 }
' compose.yml > "$next_compose"

docker compose -f "$next_compose" config >/dev/null
docker compose -f "$next_compose" up -d --no-deps --no-build lume

healthy=0
for _ in $(seq 1 30); do
  status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' lume-core 2>/dev/null || true)"
  echo "health=$status"
  if [ "$status" = healthy ]; then
    healthy=1
    break
  fi
  sleep 5
done

if [ "$healthy" -ne 1 ]; then
  docker logs --tail 100 lume-core || true
  exit 1
fi

docker exec lume-core node -e \
  "fetch('http://localhost:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
curl -fsS https://lumesocial.online/api/health >/dev/null

mv "$next_compose" compose.yml
trap - EXIT INT TERM
echo "CONTAINER_PROMOTION_HEALTHY image=$image commit=$commit rollback=$rollback_image"
