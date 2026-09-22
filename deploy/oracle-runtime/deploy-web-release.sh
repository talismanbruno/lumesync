#!/bin/sh
set -eu

# Web and server are shipped in one immutable image. Keep this legacy entry
# point as a forwarding wrapper so it cannot publish a divergent web build.
exec "$(dirname "$0")/promote-container-image.sh" "$@"
