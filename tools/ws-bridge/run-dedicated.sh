#!/usr/bin/env bash
# Dedicated lobby server for the ws-bridge demo (single-player fixture flow,
# no GL needed). Command bursts come from wc3.cmds1 (lobby open + config) and
# wc3.cmds2 (slots + config re-assert).
#
# NOTE: the engine's console does not reliably apply a multi-line command
# batch from a single write — commands are therefore re-emitted ONE PER WRITE
# with a small delay (the wc3.cmds2 loop below). startmatch fires on a timer
# so a joining client can take a slot first.
#
# Run with the repo mounted at /w and the built engine at
# open-realm/build/bin/openwarcraft3:
#   docker run -d --name wc3-dedicated --network=host \
#     -v "$PWD":/w -e WC3_DATA=/w/data-www -w /w/open-realm \
#     ghcr.io/corepunch/open-realm-ci:ubuntu-24.04 \
#     bash /w/tools/ws-bridge/run-dedicated.sh
{
  sleep 3
  cat /w/tools/ws-bridge/wc3.cmds1
  sleep 2
  while IFS= read -r wc3line; do
    echo "$wc3line"
    sleep 0.5
  done < /w/tools/ws-bridge/wc3.cmds2
  sleep 86
  echo 'startmatch Maps\Transport.w3m'
  sleep 86400
} | exec ./build/bin/openwarcraft3 -data "${WC3_DATA:-/w/data-www}" +dedicated 1 +game_port 27960 +map 'Maps\Transport.w3m'
