# Changelog — Warcraft III wasm/WebSocket port

Complete timeline of the port, newest last. Engine commit hashes refer to the
patch series in `patches/` (applied over corepunch/open-realm @ `e478da81`);
client-shell, tooling and deployment milestones are described by date.
Dates come from commit metadata and session logs.

---

## 2026-10-12 — Bootstrap

### Build system & wasm bring-up
- `b440e8b0` — build: add the `EMSCRIPTEN=1` wasm target (emscripten toolchain
  wired into the engine makefile; esdk docker image as the build environment).
- `bd85e086` — build: fix the emscripten unity schema (directory binding +
  shell variable escaping).
- `4736f06d` — wasm: complete the emscripten link path (browser + node targets).
- `a81ca0d3` — wasm: widen the `F_MMOVE` relocation guard for the wasm64 data
  layout (the port runs as wasm64 / MEMORY64 end-to-end).
- `794b17e0` — wasm: `NODERAWFS` for node smoke runs.
- `19b24b72` — wasm: namespace the engine-side client-world path store so a
  single wasm image can host the client-world path table.

### Reconnaissance
- Reverse-engineering pass over the modern (1.32+/Reforged-era) data pipeline:
  the w3mod/CASC storage layout, the SD asset layer (DDS textures, MDLX v900/
  v1000 models, FLAC audio), classic MPQ remnants inside modern data, and the
  campaign metadata files. Condensed into `docs/data-formats.md`.

## 2026-10-13 — First boots, real data, transport

### Browser loop & menu
- `a46f8a63` — wasm: browser main loop + browser build mode (no asyncify).
- `7cb690ed` — wasm: defer the menu FDF batch for browser builds.
- `fbfa0736` — docs: emscripten port notes (build modes, main loop, smoke
  harness, open issues, roadmap).

### Real game data renders
- `043dc0af` — real-data support: MDLX v1000 (SD) models, DDS texture
  resolution, null-model guards.
- `782f00ba` — `FSTRACE` file-access tracing + FDF setter null guards.
- `5d59347b` — tolerate a missing loading screen at `SV_Map` (browser FDF
  deferral edge case).

### Network transport
- `6305795a` — wasm: WebSocket transport for the browser client +
  dedicated-server lobby operations (`lobby_start`, `lobby_config`,
  `lobby_slot`, `startmatch`).
- `27aa1c54` — ws-bridge: vendor `node_modules` out (npm ci restores).
- `53cfa490` — ws-bridge: deliver lobby commands one per write (engine console
  batch quirk).
- `0e3442a5` — docs: two-browser-client verification (distinct slots, both
  clients sign on).

## 2026-10-14 — The world, multiplayer, maps

### World rendering
- `121bb592` — render the 1.32 world end-to-end: client map registration, unit
  model resolver, fog-of-war completeness.
- `25648183` — boot the full menu in the browser (module-boundary namespacing +
  client-only boot fallbacks).
- `c69747ee` — client: boot the Blizzard → War3 logo FMVs for launch parity
  with a normal game start.
- `c3cb11ba` — mdx: skip the v900+ material shader field; add the `W3_FOWOFF`
  visibility override (headless diagnostics).

### Multiplayer
- `fc4cfbe1` — server+menu: the browser lobby host can start the match.
- `a7c33730` — net+menu: in-browser LAN discovery/join; robust WS transport.
- `07fc05bf` — cleanup: strip W3DBG debug instrumentation (0 residue).

### Map catalog + fetch-on-demand + protected archives
- `5e724d56` — maps: fetch-on-demand + protected-map archives.
  - The client's virtual FS seeds zero-byte placeholders for a 568-entry
    catalog, then fetches each archive on demand (one synchronous request per
    file, per-segment URL encoding, cache-busted through a catalog hash).
  - MPQ reader hardened for protected maps: a 4096-byte header search window
    (Storm-equivalent semantics — protected headers can sit beyond the classic
    position) and base-offset-aware table clamps. Verified **byte-identical
    extraction vs StormLib** on a protected DotA map (`war3map.w3i`: 639-byte
    match).
- `51dc7fe6` — tools: dedicated lobby variant for custom/TFT maps
  (`run-dedicated-custom.sh`).

### Deployment milestones
- Public deployment live: `https://<host>/warcraft3/` — browser client +
  `wss://<host>/warcraft3/ws` → relay → UDP dedicated server on the same
  origin; two browser clients verified joining and spawning over the public
  chain.
- Mobile program: portrait rendering verified, responsive canvas (100vw/100dvh
  + safe areas), touch layer (tap/long-press/drag/pinch, multi-touch
  ownership) and gamepad layer (Gamepad API mapper) shipped as `wc3-input.js`.

## 2026-10-15 — Campaigns, then campaign polish

### Full campaign (Reign of Chaos + The Frozen Throne)
- `5d69e09e` — campaign: full RoC+TFT campaign playable in the browser.
  - **Campaign strings pipeline**: the engine consumes classic
    `UI\CampaignStrings[_exp].txt`; the modern data ships the same schema in
    `ui/campaigninfoclassic.txt` with localization keys instead of text. A
    generator (`tools/gen-campaign-strings.py`) resolves 124/124 `CAMP_*` keys
    against the enUS globalstrings table and emits both classic files.
  - **Campaign mission loading**: campaign map paths live outside `Maps\` and
    are now fetched on demand at resolve time (`FS_ResolveMapPath`).
  - **JASS native coverage**: a word-match scan over all 97 campaign mission
    scripts and Blizzard.j found **70 missing natives** (the original
    call-regex scan under-counted to 7 — it missed assignment-style calls);
    all 70 implemented in `games/warcraft-3/game/api/*` — real behavior where
    the engine data supports it (destructable skin wrappers, unit type
    classes, AoE damage, multiboard getters, …), validated accept/no-op where
    the classic engine has nothing to drive (tournament helpers, facial
    animation labels, …).
  - **Cinematic routing**: pre-rendered FMVs route to the fullscreen overlay;
    model-based cinematics (e.g. the Scourge finale) render in-engine.
  - **Progress persistence**: campaign progress saved browser-side
    (localStorage bridge for the wasm64 build — EM_JS string offsets fixed for
    MEMORY64's BigInt pointers).
- `9b195fb0` — fetch-on-demand: `.blp` requests fall back to the `.dds` store
  form (the SD data resolves textures as DDS; decoders sniff the container).

### Campaign polish — audio, icons, dialogue, minimap
- `6b705890` — campaign polish: audio decode, ability icons, dialogue text,
  minimap icons.
  - **Audio**: the SD data ships sound as FLAC only; vendored `dr_flac`, added
    a FLAC decoder to the sound system (mono S16/44.1k), page boots real SDL
    audio. Verified by live mission runs (music + voice-over queue active).
  - **Ability icons**: 1.30+ data moved per-ability button art into
    `Units\AbilitySkin.txt`; merged into the game config sources — command
    buttons stop rendering empty (0 missing-art lines on the test mission).
  - **Dialogue**: sound-attached speaker/text keys now flow into the cinematic
    scene pipeline (`PLAYERTEXT_SPEAKER`/`PLAYERTEXT_DIALOGUE`); verified
    line-by-line in live runs (e.g. "Uther the Lightbringer: Welcome, Prince
    Arthas…" displaying with its voice-over and clearing after).
  - **Minimap icons**: dedicated `svc_minimap_icon` wire channel (per-player,
    fixed 15-byte payload, add/remove/clear/visible ops) + client rendering.

## 2026-10-16 — Release

- Repository published (this repo): sanitized source + patch series + tooling
  + docs. Engine test suites pass (server_net, menu, ui-canvas, test-core,
  test-menu).

## 2026-10-18 — v0.1.0 binary release; real-GPU verification

- **First public binary release**: `wc3-web-v0.1.0.tar.gz` — the browser client
  built from this patch series with a data-free preload (engine share files and
  a placeholder only; every game file is fetched on demand from the user's own
  mirror). Verified by serving the literal release files against a fresh data
  mirror: boots to the RoC/TFT main menu and loads and plays a campaign
  mission. Wasm streaming-compile falls back cleanly on servers that do not
  send `application/wasm` (the bundled `serve.py` sends it).
- **Real-GPU verification confirmed** by the operator on the live deployment;
  the headless software-WebGL fog quirk does not reproduce on real hardware.
- Reference-mirror completeness fix: the deployment's data mirror was missing
  `ui/framedef` (invisible while UI files rode the preload; the empty-preload
  release build exposed it). The repo's own extraction pipeline
  (`make-mirror.py`) already merges base + locale layers correctly; the
  reference mirror was rebuilt (+10.9k files).
- **Sync-XHR text-decode fix (found by the empty-preload build)**: browsers
  decode text-looking bodies on the synchronous-XHR path as UTF-8 regardless
  of the declared Content-Type/charset, silently truncating non-ASCII files —
  the UI parser then ran off the end of a short `GlobalStrings.fdf` buffer and
  trapped. Fix: `make-mirror.py` emits `<path>.b64` sidecars + `b64.index.txt`
  for text-looking files; the page preloads the index and the engine fetches
  those files base64-encoded (exact bytes). The engine also refuses short
  reads instead of writing corrupt files.
- Serving guidance: the data tree should go out as a binary type
  (`application/octet-stream`); the reference Caddy rules and `serve.py` were
  updated accordingly.

---

## Verification highlights (what "works" is based on)

- Byte-identical protected-map extraction vs StormLib (`war3map.w3i`, 639 B).
- Two real browser clients on the public chain: lobby join → map fetch →
  spawn → gameplay.
- Campaign: campaign select (9 campaigns, real names/backdrops), Human01
  "The Defense of Strahnbrad" (terrain/units/quests), TFT NightElfX01
  "Rise of the Naga" (0 missing natives), Scourge finale model cinematic,
  FMV overlay for pre-rendered movies.
- Dialogue: live line-by-line transcript matched the retail script during a
  mission run (speaker + text + voice-over + clear-after).
- Persistence: crafted save file → refresh → unlock gating reflects the
  restored progress (Human-only save lists exactly 2 campaigns, not 9).
- Audio: FLAC chain active in live runs; ability icons: 0 missing-art.

## Known gaps / notes

- ~50 mission-referenced sound files are absent from the SD data set (skipped
  gracefully at play time).
- The FMV overlay plays `web/movies/<name>_{1280,640}.webm` transcodes the
  user provides (see `docs/data-prep.md`); when absent, playback is skipped
  without blocking the game.
- On headless software-WebGL stacks (CI) fog-of-war can render black;
  `?fow=off` is a diagnostics switch. Real-GPU browsers are the target.
- No binary release yet: source + patches only.
