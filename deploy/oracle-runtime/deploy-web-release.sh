#!/bin/sh
set -eu

release_id="${1:?release id is required}"
cd /home/ubuntu/lume-core

old_image="$(docker inspect --format '{{.Image}}' lume-core)"
rollback_image="lume/backspace:rollback-${release_id}"
docker image tag "$old_image" "$rollback_image"

docker compose build lume
docker compose up -d --no-deps lume

healthy=0
for _ in $(seq 1 18); do
  status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' lume-core 2>/dev/null || true)"
  echo "health=$status"
  if [ "$status" = "healthy" ]; then
    healthy=1
    break
  fi
  sleep 5
done

if [ "$healthy" -ne 1 ]; then
  docker logs --tail 80 lume-core || true
  docker image tag "$rollback_image" lume/backspace:foundation
  docker compose up -d --no-deps --force-recreate lume
  exit 1
fi

docker exec lume-core node -e "fetch('http://localhost:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
echo DEPLOY_HEALTHY
