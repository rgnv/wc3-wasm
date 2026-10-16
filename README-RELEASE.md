# Warcraft III browser client — release README

This directory is the prebuilt **wc3-web** client for the wc3-wasm project
(https://github.com/rgnv/wc3-wasm). It contains engine code only — **no game
content**.

## You need your own data

Extract a data tree from a Warcraft III installation you legally own, using
`scripts/prepare-data.sh` from the source repository (it builds the CASC
extractor and produces the lowercase mirror the client fetches from on
demand). Then arrange a served directory like this:

```
site/
├── index.html            ← from this release
├── wc3-input.js          ← from this release
├── openwarcraft3.js      ← from this release
├── openwarcraft3.wasm    ← from this release
├── openwarcraft3.data    ← from this release (engine share files only)
├── version.json          ← from this release
└── gamedata/             ← YOUR extracted mirror (prepare-data.sh output)
```

Serve `site/` with any static server that sends `.wasm` as
`application/wasm`. `serve.py` (included) does this correctly:

```bash
python3 serve.py --web . --data ./gamedata
# → http://127.0.0.1:8080/
```

The client pulls every map/asset over HTTP on demand from `gamedata/`, so the
mirror can live entirely on disk; only files the engine actually opens are
requested.

## First boot

There is no game data baked into the wasm. On the first visit the client
builds its menu and UI from your `gamedata/` mirror over HTTP — a few hundred
small requests (tens of MB), so a cold boot takes a little while against a
local server and much less on a fast LAN. Measured on a LAN: ~6–16 s to the
main menu. If you have no movie transcodes, click once through the two logo
screens at startup (the overlay's built-in skip).

## Multiplayer (optional)

A native dedicated server plus the WebSocket bridge from the source repo's
`tools/ws-bridge/` are required. Open the client with `?ws=ws://<host>:<port>`
pointing at the bridge. See the repository README.

## Legal

Warcraft III and all game content are © Blizzard Entertainment, Inc. This
release grants no rights over any of it; you must own the game. Engine/shell
code here is MIT-licensed — see LICENSE and NOTICE.md.
