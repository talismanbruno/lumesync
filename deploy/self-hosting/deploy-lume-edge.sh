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
if [[ -z "${available_kib}" || "${available_kib}" -lt 1572864 ]]; then
	printf 'Deployment stopped: at least 1.5 GiB of free disk is required.\n' >&2
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

for asset in lume-orbital-amd64.tar.gz lume-orbital-amd64.tar.gz.sha256 lume-orbital-image.txt; do
	curl --fail --location --retry 3 --retry-all-errors \
		--output "${artifact_dir}/${asset}" "${RELEASE_BASE_URL}/${asset}"
done

(
	cd "${artifact_dir}"
	sha256sum --check lume-orbital-amd64.tar.gz.sha256
)

image_ref="$(tr -d '\r\n' < "${artifact_dir}/lume-orbital-image.txt")"
if [[ "${image_ref}" != lume-orbital:* ]]; then
	printf 'Deployment stopped: unexpected image reference %q.\n' "${image_ref}" >&2
	exit 1
fi

printf 'Loading %s without rebuilding on the server...\n' "${image_ref}"
gzip --decompress --stdout "${artifact_dir}/lume-orbital-amd64.tar.gz" | "${docker_command[@]}" load
"${docker_command[@]}" image inspect "${image_ref}" >/dev/null

if [[ -f "${OVERRIDE_FILE}" ]]; then
	backup_override="$(mktemp)"
	cp -- "${OVERRIDE_FILE}" "${backup_override}"
fi

restore_previous_release() {
	printf 'Health check failed; restoring the previous app-proxy configuration...\n' >&2
	if [[ -n "${backup_override}" && -f "${backup_override}" ]]; then
		cp -- "${backup_override}" "${OVERRIDE_FILE}"
	else
		rm -f -- "${OVERRIDE_FILE}"
	fi
	local compose_args=(--env-file .env -f "${COMPOSE_FILE}")
	if [[ -f "${OVERRIDE_FILE}" ]]; then
		compose_args+=(-f "${OVERRIDE_FILE}")
	fi
	"${docker_command[@]}" compose "${compose_args[@]}" up --detach --no-deps app-proxy
}

cat > "${OVERRIDE_FILE}.next" <<EOF
services:
  app-proxy:
    image: ${image_ref}
EOF
mv -- "${OVERRIDE_FILE}.next" "${OVERRIDE_FILE}"

"${docker_command[@]}" compose --env-file .env -f "${COMPOSE_FILE}" -f "${OVERRIDE_FILE}" config --quiet
if ! "${docker_command[@]}" compose --env-file .env -f "${COMPOSE_FILE}" -f "${OVERRIDE_FILE}" \
	up --detach --no-deps app-proxy; then
	restore_previous_release
	exit 1
fi

container_id="$("${docker_command[@]}" compose --env-file .env -f "${COMPOSE_FILE}" -f "${OVERRIDE_FILE}" ps --quiet app-proxy)"
if [[ -z "${container_id}" ]]; then
	restore_previous_release
	exit 1
fi

for _attempt in $(seq 1 45); do
	status="$("${docker_command[@]}" inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container_id}")"
	case "${status}" in
		healthy)
			printf 'Lume app-proxy is healthy on %s.\n' "${image_ref}"
			exit 0
			;;
		unhealthy | exited | dead)
			break
			;;
	esac
	sleep 2
done

"${docker_command[@]}" logs --tail 80 "${container_id}" >&2 || true
restore_previous_release
exit 1
