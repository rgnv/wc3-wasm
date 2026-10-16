# Data formats the port handles (reverse-engineering notes)

Condensed notes from the reconnaissance work behind the port. All of it
applies to data **you extract from your own installation**.

## Storage

- Modern clients store the game in **CASC** (`w3mod` named roots):
  `war3.w3mod` (base game layer) plus `_locales/<locale>.w3mod` (text/audio
  layer). Names are compound (`war3.w3mod:_locales\enus.w3mod:ui\...`); the
  extractor flattens `:` and `\` into a directory tree and the mirror builder
  merges the layers.
- **Classic maps remain MPQ archives** (`.w3m`/`.w3x`) inside that storage.
  Protected maps can place their MPQ header well past the classic position —
  the reader searches the first 4096 bytes for the `MPQ\x1a` signature (the
  same window Storm uses) and clamps block tables against the archive's base
  offset. Verified byte-identical extraction against StormLib on a protected
  map.

## Assets

- **Textures**: DDS (SD store form) and BLP are both handled; requests for a
  `.blp` resolve to its `.dds` form when the SD data only ships DDS.
- **Models**: MDLX — SD models are v900/v1000; later fields (v900+ material
  shader block) are skipped by the loader. Model-attached effects and
  portraits (v1000) load.
- **Audio**: the SD tree ships **FLAC only** (mono 44.1 kHz); the client
  decodes it natively. Scripts reference sounds by path and by sound labels.
- **Movies**: FMV sources exist in the storage (`.avi`/`.webm`); the browser
  port plays them via the page overlay, which expects user-side webm
  transcodes (see `docs/data-prep.md`).

## UI & text

- FDF (frame definitions) with keys resolved against the locale layer.
- `ui/campaigninfoclassic.txt` carries the campaign select schema but with
  localization **keys** (`CAMP_*`); `tools/gen-campaign-strings.py` resolves
  them from the locale `globalstrings.fdf` (124/124 keys in enUS) and emits
  the classic `CampaignStrings[_exp].txt` the engine consumes.
- 1.30+ data moved per-ability button art to `Units\AbilitySkin.txt`
  (Art / Unart / Researchart per ability) — without it every ability button
  renders empty.

## Maps & scripting

- Map scripts (`war3map.j`) and string tables (`war3map.wts`, `TRIGSTR_*`)
  drive missions; tooltips/texts resolve through the level-string mechanism.
- The campaign's 97 mission scripts (plus Blizzard.j) were scanned
  word-for-word for engine natives; 70 that were missing got implemented —
  see `docs/CHANGELOG.md` (2026-10-15).

## Conventions observed

- Paths are case-insensitive in the engine's virtual FS; the served mirror is
  lowercased and the client requests the lowercased form.
- The engine's map paths use backslashes in scripts (`Maps\...`) and forward
  slashes in lobby commands; the fetch layer normalizes both.
