# Data preparation — extracting your own tree

The port never ships game data. This is the flow that turns **your own**
Warcraft III installation into the static tree the browser client reads.

## What you need

- A Warcraft III (Reforged-era) installation you legally own — the directory
  containing `.build.info` / `Data` (the CASC storage).
- git, cmake, g++, python3, ~6 GB of free disk.

## The flow

```bash
scripts/prepare-data.sh "/path/to/your/Warcraft III"
```

What it does:

1. Clones and builds **CascLib** (MIT, by Ladislav Zezula) under
   `third_party/` — a build dependency, never vendored.
2. Compiles **`tools/casc-extract/wc3casc.cpp`** against it.
3. Extracts the SD name list (`tools/casc-extract/extract-names.txt`,
   18,727 names: UI, models, textures, sounds, movies, the built-in Maps
   trees, scripts, locale layer) into `data-www/.stage/extracted/`.
4. Builds the served mirror at `data-www/` via `scripts/make-mirror.py`:
   the `war3.w3mod/` base layer plus the `_locales/<locale>.w3mod/` layer are
   merged (locale wins) and every path is lowercased — exactly what the
   client's fetch-on-demand requests. Text files with non-ASCII characters
   also get `<path>.b64` sidecars plus a `b64.index.txt`; browsers text-decode
   look-alike bodies on the synchronous-XHR path, so the client fetches those
   files base64-encoded and gets exact bytes.

Expect ~2–3 GB. The engine reads with the mirror root as its data base
(`WC3_DATA_BASE = gamedata/` in the shell).

## Serving

```bash
python3 scripts/serve.py          # / → web/, /gamedata/ → data-www/
```

`serve.py` handles the mandatory bits: `.wasm` as `application/wasm`, sane
cache headers, `no-store` on misses, and — importantly — it serves the whole
`gamedata/` tree as `application/octet-stream`. That last part is not
cosmetic: the client fetches files with synchronous XHR, and browsers decode
text-ish MIME types as UTF-8, which silently collapses multi-byte characters
and truncates non-ASCII files (we hit this with `.fdf` files served as
`application/vnd.fdf` — the UI parser then ran off the end of the buffer).
If you use your own server, force `Content-Type: application/octet-stream`
for everything under `gamedata/`. On-demand fetching means you do **not** need to preload
everything into the client — only files the engine actually opens are
requested.

## Optional extras

- **Custom maps**: drop `.w3x`/`.w3m` files anywhere under
  `data-www/maps/` (e.g. `maps/custom/`). To surface them in the in-game
  browser, add their paths to `data-www/maps.index.txt` (one path per line,
  relative to the mirror root) — the shell seeds the catalog from it.
- **FMV overlay**: the engine plays pre-rendered movies through a page
  overlay that expects transcodes at `web/movies/<basename>_{1280,640}.webm`
  (basename = movie filename, lowercase, extension stripped — e.g.
  `HumanOp.avi` → `humanop_1280.webm`). Transcode your own files; when a
  movie is missing the overlay skips it and play continues.
- **Preloading**: `scripts/build-wasm.sh` accepts `EM_PRELOAD` to bundle a
  small subset into the `.data` file for faster cold boot; the mirror still
  serves everything else on demand.

## Notes

- The extractor reads your install read-only; extraction doubles disk usage
  (install + loose tree + mirror).
- Locale coverage follows the name list (enUS data). Other locales extract
  the shared base layer; text-fallback behavior for non-enUS clients is not
  tested.
- A handful of mission sound files referenced by scripts are absent from the
  SD data itself; the client skips them gracefully.
