#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later

set -Eeuo pipefail

readonly RELEASE_BASE_URL="https://github.com/talismanbruno/lumesync/releases/download/lume-orbital-edge"
readonly COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
readonly OVERRIDE_FILE="${OVERRIDE_FILE:-docker-compose.lume.yml}"

if [[ ! -f "${COMPOSE_FILE}" || ! -f .env ]]; then
	printf 'Run this script from the production deploy/self-hosting directory.\n' >&2
	exit 1
fi

for command in curl docker gzip sha256sum; do
	command -v "${command}" >/dev/null 2>&1 || {
		printf 'Missing required command: %s\n' "${command}" >&2
		exit 1
	}
done

docker_command=(docker)
if ! docker info >/dev/null 2>&1; then
	if command -v sudo >/dev/null 2>&1 && sudo -n docker info >/dev/null 2>&1; then
		docker_command=(sudo -n docker)
	else
		printf 'Deployment stopped: Docker is not accessible to the current user.\n' >&2
		exit 1
	fi
fi

available_kib="$(df -Pk . | awk 'NR == 2 {print $4}')"
if [[ -z "${available_kib}" || "${available_kib}" -lt 4194304 ]]; then
	printf 'Deployment stopped: at least 4 GiB of free disk is required.\n' >&2
	exit 1
fi

artifact_dir="$(mktemp -d)"
backup_override=""
cleanup() {
	rm -rf -- "${artifact_dir}"
	if [[ -n "${backup_override}" && -f "${backup_override}" ]]; then
		rm -f -- "${backup_override}"
	fi
}
trap cleanup EXIT

for asset in \
	lume-orbital-amd64.tar.gz \
	lume-orbital-amd64.tar.gz.sha256 \
	lume-orbital-image.txt \
	lume-api-amd64.tar.gz \
	lume-api-amd64.tar.gz.sha256 \
	lume-api-image.txt; do
	curl --fail --location --retry 3 --retry-all-errors \
		--output "${artifact_dir}/${asset}" "${RELEASE_BASE_URL}/${asset}"
done

(
	cd "${artifact_dir}"
	sha256sum --check lume-orbital-amd64.tar.gz.sha256
	sha256sum --check lume-api-amd64.tar.gz.sha256
)

image_ref="$(tr -d '\r\n' < "${artifact_dir}/lume-orbital-image.txt")"
api_image_ref="$(tr -d '\r\n' < "${artifact_dir}/lume-api-image.txt")"
if [[ "${image_ref}" != lume-orbital:* ]]; then
	printf 'Deployment stopped: unexpected image reference %q.\n' "${image_ref}" >&2
	exit 1
fi
if [[ "${api_image_ref}" != lume-api:* ]]; then
	printf 'Deployment stopped: unexpected API image reference %q.\n' "${api_image_ref}" >&2
	exit 1
fi

printf 'Loading %s and %s without rebuilding on the server...\n' "${image_ref}" "${api_image_ref}"
gzip --decompress --stdout "${artifact_dir}/lume-orbital-amd64.tar.gz" | "${docker_command[@]}" load
gzip --decompress --stdout "${artifact_dir}/lume-api-amd64.tar.gz" | "${docker_command[@]}" load
"${docker_command[@]}" image inspect "${image_ref}" >/dev/null
"${docker_command[@]}" image inspect "${api_image_ref}" >/dev/null

if [[ -f "${OVERRIDE_FILE}" ]]; then
	backup_override="$(mktemp)"
	cp -- "${OVERRIDE_FILE}" "${backup_override}"
fi

restore_previous_release() {
	printf 'Health check failed; restoring the previous Lume configuration...\n' >&2
	if [[ -n "${backup_override}" && -f "${backup_override}" ]]; then
		cp -- "${backup_override}" "${OVERRIDE_FILE}"
	else
		rm -f -- "${OVERRIDE_FILE}"
	fi
	local compose_args=(--env-file .env -f "${COMPOSE_FILE}")
	if [[ -f "${OVERRIDE_FILE}" ]]; then
		compose_args+=(-f "${OVERRIDE_FILE}")
	fi
	"${docker_command[@]}" compose "${compose_args[@]}" up --detach --no-deps api worker app-proxy
}

cat > "${OVERRIDE_FILE}.next" <<EOF
services:
  app-proxy:
    image: ${image_ref}
  api:
    image: ${api_image_ref}
  worker:
    image: ${api_image_ref}
EOF
mv -- "${OVERRIDE_FILE}.next" "${OVERRIDE_FILE}"

"${docker_command[@]}" compose --env-file .env -f "${COMPOSE_FILE}" -f "${OVERRIDE_FILE}" config --quiet
"${docker_command[@]}" compose --env-file .env -f "${COMPOSE_FILE}" -f "${OVERRIDE_FILE}" \
	up --detach --no-deps api worker app-proxy

app_container_id="$("${docker_command[@]}" compose --env-file .env -f "${COMPOSE_FILE}" -f "${OVERRIDE_FILE}" ps --quiet app-proxy)"
api_container_id="$("${docker_command[@]}" compose --env-file .env -f "${COMPOSE_FILE}" -f "${OVERRIDE_FILE}" ps --quiet api)"
worker_container_id="$("${docker_command[@]}" compose --env-file .env -f "${COMPOSE_FILE}" -f "${OVERRIDE_FILE}" ps --quiet worker)"
if [[ -z "${app_container_id}" || -z "${api_container_id}" || -z "${worker_container_id}" ]]; then
	restore_previous_release
	exit 1
fi

for _attempt in $(seq 1 45); do
	app_status="$("${docker_command[@]}" inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${app_container_id}")"
	api_status="$("${docker_command[@]}" inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${api_container_id}")"
	worker_status="$("${docker_command[@]}" inspect --format '{{.State.Status}}' "${worker_container_id}")"
	if [[ "${app_status}" == healthy && "${api_status}" == healthy && "${worker_status}" == running ]]; then
		printf 'Lume app and API are healthy on %s and %s.\n' "${image_ref}" "${api_image_ref}"
		exit 0
	fi
	if [[ "${app_status}" =~ ^(unhealthy|exited|dead)$ || "${api_status}" =~ ^(unhealthy|exited|dead)$ || "${worker_status}" =~ ^(exited|dead)$ ]]; then
		break
	fi
	sleep 2
done

"${docker_command[@]}" logs --tail 80 "${app_container_id}" >&2 || true
"${docker_command[@]}" logs --tail 80 "${api_container_id}" >&2 || true
"${docker_command[@]}" logs --tail 80 "${worker_container_id}" >&2 || true
restore_previous_release
exit 1
