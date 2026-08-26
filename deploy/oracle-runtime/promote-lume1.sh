#!/bin/sh
set -eu

release_id="46d1b5cf"
app_dir="/home/ubuntu/lume-core"
next_web="$app_dir/web-dist.next-$release_id"
old_web="$app_dir/web-dist.pre-$release_id"
failed_web="$app_dir/web-dist.failed-$release_id"

cd "$app_dir"
test "$(pwd -P)" = "$app_dir"
test -s "lume-web-beta4-$release_id.tar.gz"
test -s "source/lume-source-90edba12.tar.gz"
test -s compose.yml.lume1.next
test ! -e "$next_web"
test ! -e "$old_web"

cp compose.yml "compose.yml.pre-$release_id"
cp .env ".env.pre-$release_id"
mkdir "$next_web"
tar -xzf "lume-web-beta4-$release_id.tar.gz" -C "$next_web"

rollback() {
  code="$?"
  trap - EXIT INT TERM
  set +e
  cp "compose.yml.pre-$release_id" compose.yml
  cp ".env.pre-$release_id" .env
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
cp compose.yml.lume1.next compose.yml

if grep -q '^BACKSPACE_SOURCE_URL=' .env; then
  sed -i 's#^BACKSPACE_SOURCE_URL=.*#BACKSPACE_SOURCE_URL=https://lumesocial.online/source/lume-source-90edba12.tar.gz#' .env
else
  printf '%s\n' 'BACKSPACE_SOURCE_URL=https://lumesocial.online/source/lume-source-90edba12.tar.gz' >> .env
fi
if grep -q '^BACKSPACE_COMMIT=' .env; then
  sed -i 's#^BACKSPACE_COMMIT=.*#BACKSPACE_COMMIT=90edba12#' .env
else
  printf '%s\n' 'BACKSPACE_COMMIT=90edba12' >> .env
fi

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
docker inspect --format '{{.Config.Image}}' lume-core

trap - EXIT INT TERM
echo PROMOTION_HEALTHY
