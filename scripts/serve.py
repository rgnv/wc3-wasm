#!/usr/bin/env python3
"""Serve the wasm client + the extracted data mirror for local play.

usage: python3 scripts/serve.py [--port 8080] [--web <dir>] [--data <dir>]
defaults: --web <repo>/web   --data <repo>/data-www

Routes:
  /            the client shell (web/index.html + the engine bins you copied in)
  /gamedata/   the extracted data mirror (the page's WC3_DATA_BASE)

Headers: .wasm -> application/wasm, .data -> application/octet-stream, shell
assets cached immutably, data files cached 5 minutes, misses no-store so a
later request can pick up files added afterwards.
"""
import argparse
import os
import posixpath
import http.server

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)


def make_handler(web_root, data_root):
    class Handler(http.server.SimpleHTTPRequestHandler):
        _data_root = os.path.abspath(data_root)

        extensions_map = {
            **http.server.SimpleHTTPRequestHandler.extensions_map,
            ".wasm": "application/wasm",
            ".data": "application/octet-stream",
            ".js": "text/javascript",
            ".mjs": "text/javascript",
            ".webm": "video/webm",
        }

        def guess_type(self, path):
            # Data files are fetched with synchronous XHR; Chromium decodes
            # text-ish MIME types as UTF-8 and mangles non-ASCII bytes. Serve
            # the whole data tree as a binary type so responseText stays
            # byte-for-byte identical to the file.
            try:
                ap = os.path.abspath(path)
                if ap.startswith(os.path.abspath(self._data_root) + os.sep):
                    return "application/octet-stream"
            except Exception:
                pass
            return super().guess_type(path)

        def translate_path(self, path):
            path = path.split("?", 1)[0].split("#", 1)[0]
            if path.startswith("/gamedata/"):
                rel = posixpath.normpath(path[len("/gamedata/"):]).lstrip("/")
                return os.path.join(data_root, *rel.split("/"))
            rel = posixpath.normpath(path).lstrip("/")
            if not rel:
                rel = "index.html"
            return os.path.join(web_root, *rel.split("/"))

        def send_response(self, code, message=None):
            super().send_response(code, message)
            self._status = code

        def end_headers(self):
            p = self.path.split("?")[0]
            if getattr(self, "_status", 200) == 404:
                self.send_header("Cache-Control", "no-store")
            elif p.startswith("/gamedata/"):
                self.send_header("Cache-Control", "public, max-age=300")
            elif p.endswith((".wasm", ".data", ".js", ".mjs")):
                self.send_header("Cache-Control", "public, max-age=604800, immutable")
            super().end_headers()

        def log_message(self, fmt, *args):
            pass  # keep the console readable; flip to super() for request logs

    return Handler


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8080)
    ap.add_argument("--web", default=os.path.join(REPO, "web"))
    ap.add_argument("--data", default=os.path.join(REPO, "data-www"))
    args = ap.parse_args()

    handler = make_handler(os.path.abspath(args.web), os.path.abspath(args.data))
    with http.server.ThreadingHTTPServer(("0.0.0.0", args.port), handler) as httpd:
        print(f"web   : {args.web}")
        print(f"data  : {args.data}  (served at /gamedata/)")
        print(f"open  : http://127.0.0.1:{args.port}/")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
