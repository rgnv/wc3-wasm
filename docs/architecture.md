# Architecture — how the browser port fits together

```
┌──────────────────────────── browser tab ────────────────────────────┐
│  web/index.html  (shell)                                            │
│   ├─ loads openwarcraft3.js/.wasm/.data  (wasm64 engine, GLES3→WebGL2)│
│   ├─ wc3-input.js  (touch + gamepad → synthetic DOM input events)   │
│   ├─ FMV overlay   (web/movies/*.webm, engine-driven)               │
│   ├─ seeds the map catalog (zero-byte placeholders + fetch hash)    │
│   └─ derives the multiplayer URL (same-origin wss://…/ws or ?ws=)   │
└──────────────┬─────────────────────────────┬────────────────────────┘
               │ HTTP (fetch-on-demand)      │ WebSocket (game traffic)
               ▼                             ▼
        data mirror (static)          tools/ws-bridge/bridge.mjs
        /gamedata/**                  (1 ws frame = 1 UDP datagram)
                                              │ UDP
                                              ▼
                                     native dedicated server
                                     (open-realm build/bin/openwarcraft3)
```

## Components

| Piece | Where | Role |
| --- | --- | --- |
| Engine | `patches/` over upstream | wasm64 client build + native dedicated-server build. |
| Shell | `web/` | Boots the engine, FMV overlay, input layers, catalog seeding, transport derivation, build-id negotiation. |
| Data mirror | `scripts/prepare-data.sh` | Your extracted SD tree, lowercased, served as static files. |
| Bridge | `tools/ws-bridge/bridge.mjs` | WebSocket ⇄ UDP relay; each browser connection gets its own ephemeral UDP socket, so the game server sees a distinct client address per browser. |
| Server scripts | `tools/ws-bridge/run-dedicated*.sh` | Drive the native engine into a dedicated lobby / match over its console. |

## Fetch-on-demand (the data path)

The wasm client's virtual filesystem starts with a catalog of placeholders;
every file the engine actually opens is fetched from the HTTP mirror on the
first attempt:

- The shell seeds the in-game map browser with the full catalog
  (`gamedata/maps.index.txt` → zero-byte placeholders in MEMFS); opening a
  map triggers the engine's fetch hook (`common.c` `WC3_FetchRemoteFile`).
- Requests are URL-safe per path segment (map files legitimately contain `+`,
  spaces, parentheses); a catalog hash is appended as a cache-buster so a
  changed mirror never serves stale content.
- `.blp` texture requests fall back to the `.dds` store form — the SD data
  ships DDS, and the decoders sniff the container.
- Recommended serving policy (what `scripts/serve.py` implements): shell +
  wasm immutable; data files short-cache; misses `no-store` so later requests
  can pick up files added after the client has warmed up.

## Transport (the multiplayer path)

- The page derives the WebSocket URL from its own location (same-origin
  `wss://<host><path>/ws`) or accepts `?ws=` for local runs.
- The engine carries its UDP protocol inside WebSocket binary frames — one
  frame is one datagram, both directions, verbatim.
- The bridge is protocol-agnostic: it forwards bytes and maintains one UDP
  socket per connection.
- The dedicated server is the *native* engine build with `+dedicated 1`;
  lobby/machine state is driven through its console (the run scripts emit
  commands one per write — the engine console does not reliably apply
  multi-line batches from a single write).

## Campaign pipeline

- Classic `CampaignStrings[_exp].txt` are generated from the modern data
  (`tools/gen-campaign-strings.py`), so the engine shows literal campaign
  names instead of localization keys.
- Campaign maps live outside `Maps\` and are fetched at resolve time.
- Mission dialogue rides the sound objects: speaker/text keys set on a sound
  are pushed into the cinematic scene presentation when that sound starts,
  mirroring retail behavior.
- Progress persists browser-side across reloads.

## Build-id negotiation

`version.json` (written per deploy) is fetched `no-store`; the shell points
every engine asset URL at `?v=<build>`, while those URLs are served
`immutable` — a new build is picked up because its id changes, and old builds
never poison caches.
