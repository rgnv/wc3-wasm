#!/usr/bin/env bash
# Fetch the pinned upstream engine tree and apply the port patch series.
# Result: ./open-realm = corepunch/open-realm @ e478da81 + 28 port patches.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PIN=e478da8156d8e7d0e36e9d9a84f79986c047cd22
DEST="${1:-$HERE/open-realm}"

if [ ! -d "$DEST/.git" ]; then
  git clone https://github.com/corepunch/open-realm.git "$DEST"
fi
git -C "$DEST" checkout -q "$PIN"
git -C "$DEST" checkout -q -B wasm-port
git -C "$DEST" -c user.name='wc3-wasm' -c user.email='wc3-wasm@users.noreply.github.com' \
  am "$HERE"/patches/*.patch
echo "engine ready: $DEST (wasm-port = $PIN + $(ls "$HERE"/patches | wc -l) patches)"
