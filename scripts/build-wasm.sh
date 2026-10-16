#!/usr/bin/env bash
# Build the browser (wasm64) client with the Emscripten docker image.
# Output: open-realm/build/em-web/bin/openwarcraft3.{js,wasm,data}
#
# EM_PRELOAD (optional): --preload-file <dir>@/data bundles a data tree into
# the .data file for startup. The client otherwise pulls every file it needs
# from the HTTP data mirror on demand (see docs/data-prep.md), so an empty
# preload works; a small preload just boots faster.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
ENGINE="$HERE/open-realm"
PRELOAD="${EM_PRELOAD:-}"

[ -d "$ENGINE" ] || { echo "run scripts/setup-sources.sh first" >&2; exit 1; }
mkdir -p "$HERE/emsdk-cache"

docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp \
  -e EM_CACHE=/emsdk/upstream/emscripten/cache \
  -v "$HERE":/src \
  -v "$HERE/emsdk-cache":/emsdk/upstream/emscripten/cache \
  -w /src/open-realm emscripten/emsdk:latest \
  bash -lc "make EMSCRIPTEN=1 EM_FS=browser GL_BACKEND=gles3 -k -j\$(nproc) \
    BIN_DIR=build/em-web/bin LIB_DIR=build/em/lib SHARE_INSTALL=build/em-web/share \
    EM_PRELOAD='$PRELOAD' build/em-web/bin/openwarcraft3.js"
echo "done: $ENGINE/build/em-web/bin/"
