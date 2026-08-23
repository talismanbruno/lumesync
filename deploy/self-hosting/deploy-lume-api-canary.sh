#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later

set -Eeuo pipefail

readonly SOURCE_SHA="${1:-}"
readonly SOURCE_REPO="${SOURCE_REPO:-talismanbruno/lumesync}"
readonly CURRENT_API_CONTAINER="${CURRENT_API_CONTAINER:-fluxer-api-1}"
readonly CANDIDATE_CONTAINER="${CANDIDATE_CONTAINER:-lume-api-candidate}"
readonly CADDY_CONTAINER="${CADDY_CONTAINER:-fluxer-caddy-1}"
readonly CADDY_FILE="${CADDY_FILE:-Caddyfile}"
readonly PATCH_PATH="fluxer_api/src/api/infrastructure/EntityAssetService.ts"

if [[ ! "${SOURCE_SHA}" =~ ^[0-9a-f]{40}$ ]]; then
	printf 'Usage: %s <full-git-sha>\n' "$0" >&2
	exit 2
fi

if [[ ! -f "${CADDY_FILE}" ]]; then
	printf 'Run this script from the production deploy/self-hosting directory.\n' >&2
	exit 1
fi

for command in curl docker awk grep mktemp; do
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
		printf 'Deployment stopped: Docker is not accessible.\n' >&2
		exit 1
	fi
fi

current_status="$("${docker_command[@]}" inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${CURRENT_API_CONTAINER}")"
if [[ "${current_status}" != healthy ]]; then
	printf 'Deployment stopped: current API is not healthy (%s).\n' "${current_status}" >&2
	exit 1
fi

readonly temp_dir="$(mktemp -d)"
readonly patch_file="${temp_dir}/EntityAssetService.ts"
readonly env_file="${temp_dir}/api.env"
readonly build_container="lume-api-patch-build-${SOURCE_SHA:0:12}"
readonly image_ref="lume-api-patch:${SOURCE_SHA}"
readonly caddy_next="${temp_dir}/Caddyfile.next"
readonly caddy_backup="${CADDY_FILE}.before-lume-api"

cleanup() {
	"${docker_command[@]}" rm -f "${build_container}" >/dev/null 2>&1 || true
	rm -rf -- "${temp_dir}"
}
trap cleanup EXIT

printf 'Downloading the reviewed API patch for %s...\n' "${SOURCE_SHA}"
curl --fail --location --retry 3 --retry-all-errors \
	--output "${patch_file}" \
	"https://raw.githubusercontent.com/${SOURCE_REPO}/${SOURCE_SHA}/${PATCH_PATH}"

if ! grep -Fq 'if (!animated)' "${patch_file}" || ! grep -Fq 'let uploadBuffer = imageBuffer' "${patch_file}"; then
	printf 'Deployment stopped: the expected animated-asset fast path is missing.\n' >&2
	exit 1
fi

network="$("${docker_command[@]}" inspect --format '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}}{{end}}' "${CURRENT_API_CONTAINER}")"
if [[ -z "${network}" ]]; then
	printf 'Deployment stopped: could not resolve the API Docker network.\n' >&2
	exit 1
fi

base_image="$("${docker_command[@]}" inspect --format '{{.Config.Image}}' "${CURRENT_API_CONTAINER}")"
"${docker_command[@]}" inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "${CURRENT_API_CONTAINER}" > "${env_file}"
chmod 600 "${env_file}"

"${docker_command[@]}" rm -f "${CANDIDATE_CONTAINER}" >/dev/null 2>&1 || true
"${docker_command[@]}" create --name "${build_container}" "${base_image}" >/dev/null
"${docker_command[@]}" cp \
	"${patch_file}" \
	"${build_container}:/usr/src/app/fluxer_api/src/api/infrastructure/EntityAssetService.ts"
"${docker_command[@]}" commit \
	--change "LABEL lume.source_sha=${SOURCE_SHA}" \
	"${build_container}" "${image_ref}" >/dev/null
"${docker_command[@]}" rm "${build_container}" >/dev/null

printf 'Warming the candidate API alongside the healthy production API...\n'
"${docker_command[@]}" run --detach \
	--name "${CANDIDATE_CONTAINER}" \
	--restart unless-stopped \
	--network "${network}" \
	--network-alias "${CANDIDATE_CONTAINER}" \
	--env-file "${env_file}" \
	--memory 256m \
	--memory-swap 768m \
	--health-cmd "node -e \"fetch('http://127.0.0.1:8080/_health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\"" \
	--health-interval 10s \
	--health-timeout 5s \
	--health-retries 30 \
	--health-start-period 90s \
	"${image_ref}" >/dev/null

candidate_status=starting
for _attempt in $(seq 1 180); do
	candidate_status="$("${docker_command[@]}" inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${CANDIDATE_CONTAINER}")"
	case "${candidate_status}" in
		healthy)
			break
			;;
		unhealthy | exited | dead)
			"${docker_command[@]}" logs --tail 120 "${CANDIDATE_CONTAINER}" >&2 || true
			printf 'Candidate API failed before traffic was switched. Production was untouched.\n' >&2
			exit 1
			;;
	esac
	sleep 5
done

if [[ "${candidate_status}" != healthy ]]; then
	"${docker_command[@]}" logs --tail 120 "${CANDIDATE_CONTAINER}" >&2 || true
	printf 'Candidate API did not become healthy in time. Production was untouched.\n' >&2
	exit 1
fi

replacement_count="$(grep -Ec '^[[:space:]]*reverse_proxy api:8080[[:space:]]*$' "${CADDY_FILE}")"
if [[ "${replacement_count}" -ne 3 ]]; then
	printf 'Deployment stopped: expected 3 API upstreams in Caddyfile, found %s.\n' "${replacement_count}" >&2
	exit 1
fi

awk '
	/^[[:space:]]*reverse_proxy api:8080[[:space:]]*$/ {
		match($0, /^[[:space:]]*/)
		indent = substr($0, RSTART, RLENGTH)
		print indent "reverse_proxy lume-api-candidate:8080 fluxer-api-1:8080 {"
		print indent "\tlb_policy first"
		print indent "\thealth_uri /_health"
		print indent "\thealth_interval 10s"
		print indent "\tfail_duration 10s"
		print indent "\tmax_fails 1"
		print indent "}"
		next
	}
	{print}
' "${CADDY_FILE}" > "${caddy_next}"

"${docker_command[@]}" cp "${caddy_next}" "${CADDY_CONTAINER}:/tmp/Caddyfile.lume-next"
"${docker_command[@]}" exec "${CADDY_CONTAINER}" caddy validate \
	--config /tmp/Caddyfile.lume-next --adapter caddyfile >/dev/null

cp -- "${CADDY_FILE}" "${caddy_backup}"
cp -- "${caddy_next}" "${CADDY_FILE}"
if ! "${docker_command[@]}" exec "${CADDY_CONTAINER}" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile; then
	cp -- "${caddy_backup}" "${CADDY_FILE}"
	"${docker_command[@]}" exec "${CADDY_CONTAINER}" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile || true
	printf 'Caddy reload failed. The previous API route was restored.\n' >&2
	exit 1
fi

public_base_url="$(grep -E '^FLUXER_PUBLIC_ORIGIN=' .env | tail -n 1 | cut -d= -f2- | tr -d '\r\"')"
if [[ -z "${public_base_url}" ]]; then
	public_domain="$(grep -E '^FLUXER_DOMAIN=' .env | tail -n 1 | cut -d= -f2- | tr -d '\r\"')"
	public_scheme="$(grep -E '^FLUXER_PUBLIC_SCHEME=' .env | tail -n 1 | cut -d= -f2- | tr -d '\r\"')"
	public_base_url="${public_scheme:-https}://${public_domain}"
fi

if ! curl --fail --silent --show-error --max-time 20 "${public_base_url%/}/api/_health" >/dev/null; then
	cp -- "${caddy_backup}" "${CADDY_FILE}"
	"${docker_command[@]}" exec "${CADDY_CONTAINER}" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile || true
	printf 'Public health check failed. The previous API route was restored.\n' >&2
	exit 1
fi

printf 'Candidate API %s is healthy and serving public API traffic.\n' "${image_ref}"
printf 'The original API remains online as the automatic fallback.\n'
