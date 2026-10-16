#!/usr/bin/env bash
# Dedicated lobby for the browser-host flow: real map (Frozen Throne
# Bandit Ridge), NO timer startmatch — the browser lobby host presses Start.
# Config FIRST (slot_count gates the slot commands), then the slot block.
#
# Same docker run shape as run-dedicated.sh; serve the same data tree to the
# browser clients so a joining client can fetch the map on demand.
{
  sleep 75
  echo 'lobby_start Maps/frozenthrone/(2)banditridge.w3x'
  echo 'lobby_config 2 12 Maps/frozenthrone/(2)banditridge.w3x'
  sleep 2
  while IFS= read -r wc3line; do
    echo "$wc3line"
    sleep 0.5
  done <<'SLOTS'
lobby_slot 1 1 1 0 0 1 1 Open
lobby_slot 2 1 2 0 0 1 2 Open
lobby_slot 3 1 3 0 0 1 3 Open
lobby_slot 4 1 4 0 0 1 4 Open
lobby_slot 5 1 5 0 0 1 5 Open
lobby_slot 6 1 6 0 0 1 6 Open
lobby_slot 7 1 7 0 0 1 7 Open
lobby_slot 8 1 8 0 0 1 8 Open
lobby_slot 9 1 9 0 0 1 9 Open
lobby_slot 10 1 10 0 0 1 10 Open
lobby_slot 11 1 11 0 0 1 11 Open
SLOTS
  sleep 86400
} | exec ./build/bin/openwarcraft3 -data "${WC3_DATA:-/w/data-www}" +dedicated 1 +game_port 27960 +map 'Maps/frozenthrone/(2)banditridge.w3x'
