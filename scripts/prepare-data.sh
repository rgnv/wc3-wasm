#!/usr/bin/env bash
# Build the CASC extractor and pull the Warcraft III SD data tree out of YOUR
# OWN installation into a servable mirror.
#
#   usage: prepare-data.sh <wc3-install-dir> [out-dir]
#
# <wc3-install-dir> = your Warcraft III (Reforged-era) installation — the
# directory containing .build.info / Data. Nothing is downloaded here except
# the CascLib build dependency; all game content comes from your own install.
#
# Output: <out-dir>/ = lowercase served mirror (the client's WC3_DATA_BASE).
# Re-running is safe; extraction is skipped when the stage already exists.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
WC3="${1:?usage: prepare-data.sh <wc3-install-dir> [out-dir]}"
OUT="${2:-$HERE/data-www}"
TP="$HERE/third_party"

mkdir -p "$TP" "$OUT"
STAGE="$OUT/.stage"

# 1. CascLib (MIT) — built from source, not vendored
if [ ! -d "$TP/CascLib" ]; then
  git clone --depth 1 https://github.com/ladislav-zezula/CascLib.git "$TP/CascLib"
fi
if [ ! -d "$TP/CascLib/build" ]; then
  cmake -S "$TP/CascLib" -B "$TP/CascLib/build" -DCMAKE_BUILD_TYPE=Release >/dev/null
fi
cmake --build "$TP/CascLib/build" -j"$(nproc)" >/dev/null

# 2. build wc3casc
g++ -O2 "$HERE/tools/casc-extract/wc3casc.cpp" \
  -I"$TP/CascLib/src" -I"$TP/CascLib/deps" \
  -L"$TP/CascLib/build" -lcasc -lz -lpthread \
  -Wl,-rpath,"$TP/CascLib/build" -o "$TP/wc3casc"
echo "extractor: $TP/wc3casc"

# 3. extract the SD data list (18,727 names -> war3.w3mod/... loose tree)
if [ ! -d "$STAGE/extracted/war3.w3mod" ]; then
  "$TP/wc3casc" extract-list "$WC3" \
    "$HERE/tools/casc-extract/extract-names.txt" "$STAGE/extracted"
fi

# 4. merge locale layers + lowercase -> the served mirror
python3 "$HERE/scripts/make-mirror.py" "$STAGE/extracted" "$OUT"

echo
echo "done: $OUT"
echo "next:"
echo "  cp open-realm/build/em-web/bin/openwarcraft3.* web/"
echo "  python3 scripts/serve.py          # -> http://127.0.0.1:8080/"
echo "optional: put extra .w3x maps in $OUT/maps/custom/ (served on demand)"
echo "optional: transcode your own FMVs to web/movies/<name>_{1280,640}.webm"
echo "          (the movie overlay skips gracefully when they are absent)"
