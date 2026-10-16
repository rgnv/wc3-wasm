#!/usr/bin/env node
/*
 * WS <-> UDP bridge for the browser (wasm) OpenWarcraft3 client.
 *
 * The engine speaks UDP; browsers only speak WebSocket. Each browser
 * connection gets its own ephemeral UDP socket, so the game server sees a
 * distinct client address per browser. Binary WS frames are forwarded
 * verbatim in both directions (one frame == one datagram).
 *
 * usage: node bridge.mjs [--listen 8790] [--target 127.0.0.1:27960] [--verbose]
 */
import { WebSocketServer } from "ws";
import dgram from "node:dgram";

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf("--" + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}
const listenPort = parseInt(arg("listen", "8790"), 10);
const listenHost = arg("host", "127.0.0.1");
const target = arg("target", "127.0.0.1:27960");
const [targetHost, targetPortStr] = target.split(":");
const targetPort = parseInt(targetPortStr, 10);
const verbose = args.includes("--verbose");

let totalClients = 0;

const wss = new WebSocketServer({ host: listenHost, port: listenPort });
console.log(`[bridge] listening ws://${listenHost}:${listenPort} -> udp ${targetHost}:${targetPort}`);

wss.on("connection", (ws, req) => {
  const id = ++totalClients;
  const udp = dgram.createSocket("udp4");
  let bytesUp = 0;
  let bytesDown = 0;

  udp.on("message", (msg) => {
    bytesDown += msg.length;
    if (ws.readyState === ws.OPEN) ws.send(msg);
    if (verbose) console.log(`[bridge] #${id} udp->ws ${msg.length}b (total down ${bytesDown})`);
  });
  udp.on("error", (err) => console.log(`[bridge] #${id} udp error: ${err.message}`));

  ws.on("message", (data) => {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    bytesUp += buf.length;
    udp.send(buf, targetPort, targetHost);
    if (verbose) console.log(`[bridge] #${id} ws->udp ${buf.length}b (total up ${bytesUp})`);
  });
  ws.on("close", () => {
    console.log(`[bridge] #${id} closed (up ${bytesUp}b, down ${bytesDown}b)`);
    try { udp.close(); } catch {}
  });
  ws.on("error", (err) => console.log(`[bridge] #${id} ws error: ${err.message}`));

  console.log(`[bridge] #${id} connected from ${req.socket.remoteAddress}`);
});
