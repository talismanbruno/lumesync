#!/bin/sh
set -eu

archive="${1:?web archive is required}"
release_id="${2:?release id is required}"
app_dir="/home/ubuntu/lume-core"
next_web="$app_dir/web-dist.next-$release_id"
old_web="$app_dir/web-dist.pre-$release_id"
failed_web="$app_dir/web-dist.failed-$release_id"

cd "$app_dir"
test "$(pwd -P)" = "$app_dir"
test -s "$archive"
test ! -e "$next_web"
test ! -e "$old_web"

mkdir "$next_web"
tar -xzf "$archive" -C "$next_web"
test -s "$next_web/index.html"

rollback() {
  code="$?"
  trap - EXIT INT TERM
  set +e
  if [ -d "$old_web" ]; then
    if [ -d web-dist ]; then mv web-dist "$failed_web"; fi
    mv "$old_web" web-dist
  fi
  docker compose up -d --no-deps --force-recreate lume
  exit "$code"
}
trap rollback EXIT INT TERM

mv web-dist "$old_web"
mv "$next_web" web-dist
docker compose up -d --no-deps --force-recreate lume

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
test "$healthy" -eq 1
docker exec lume-core node -e "fetch('http://localhost:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
curl -fsS https://lumesocial.online/api/health

trap - EXIT INT TERM
echo WEB_PROMOTION_HEALTHY
