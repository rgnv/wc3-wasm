# NOTICE — scope, provenance, and what is *not* in this repository

## What this repository contains

Original code and documentation produced for the Warcraft III → WebAssembly/WebSocket port:

- a **29-patch source series** (`patches/`) that adapts the pinned upstream engine tree for Emscripten/wasm64 and the browser (transport, data loading, rendering fixes, campaign/native coverage),
- the browser shell (`web/`) — the page that boots the engine, negotiates build ids, plays the FMV overlay and seeds the map catalog,
- the WebSocket ⇄ UDP bridge and dedicated-server run scripts (`tools/ws-bridge/`),
- the CASC extractor (`tools/casc-extract/wc3casc.cpp`) plus the SD data name list it consumes — the tooling that pulls a data tree out of **your own** Warcraft III installation,
- data/mirror/serve scripts (`scripts/`) and the campaign-strings generator (`tools/gen-campaign-strings.py`),
- technical documentation (`docs/`), including the full port changelog.

## What this repository does NOT contain

- **No game data. Ever.** No maps, models, textures, sounds, music, movies, scripts, or any other Warcraft III content is stored in this repository, its git history, or its releases. The engine written to wasm loads everything it needs from *your own* extracted data tree at runtime over HTTP.
- **No engine source tree.** The engine is fetched by `scripts/setup-sources.sh` from the upstream project; what this repository stores is the patch series that adapts it, not the tree itself.

## Provenance of the engine source the patches apply to

The patch series is written against **corepunch/open-realm** (github.com/corepunch/open-realm), an MIT-licensed, from-scratch Warcraft III engine reimplementation, pinned at commit `e478da81`. That project is fetched, not distributed, by this repository; nothing here grants any rights over it. The patches are published for reproducible interoperability work on a tree each user obtains for themselves. Engine-side changes were developed against that tree and are carried as `git format-patch` output only.

## Game data

Warcraft III (Reign of Chaos, The Frozen Throne, Reforged) and all of its content are © Blizzard Entertainment, Inc. No license to any of it is granted here. To run this port you must supply **your own legally obtained copy** — e.g. an installation made through your own Battle.net account. `scripts/prepare-data.sh` extracts the data tree from that installation on your own machine for your own use; nothing is re-hosted, bundled, or redistributed by this repository, and no downloads of game content are performed by any script here.

The SD (classic) data the port reads is the Reforged-era package set (w3mod/CASC layout). Compatibility is limited to what is covered in `docs/`; it is verified against the retail 1.32-era data pipeline and the SD asset layer shipped in current clients.

## Screenshots

Screenshots under `screenshots/` are captures of the port running against a privately owned installation. Warcraft III content shown in them is © Blizzard Entertainment, Inc.

## Release binaries

No compiled release binaries are published at this time — the repository is source + patches only. Any future binary releases will follow the same rule as this repository: engine code only, never a byte of game content, for use with your own legally obtained data.
