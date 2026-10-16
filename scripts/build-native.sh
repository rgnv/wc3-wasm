#!/usr/bin/env bash
# Build the NATIVE client + dedicated server (linux x86_64) with the CI image.
# Output: open-realm/build/bin/openwarcraft3 — used for the dedicated game
# server side of the multiplayer setup (docs/architecture.md).
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
ENGINE="$HERE/open-realm"
[ -d "$ENGINE" ] || { echo "run scripts/setup-sources.sh first" >&2; exit 1; }

docker run --rm -v "$HERE":/src -w /src/open-realm \
  ghcr.io/corepunch/open-realm-ci:ubuntu-24.04 \
  bash -lc "make -j\$(nproc) build/bin/openwarcraft3"
echo "done: $ENGINE/build/bin/openwarcraft3"
