#!/usr/bin/env python3
"""Build the lowercase served mirror from an extracted CASC tree.

Input : <extracted>/ = output of `wc3casc extract-list` (layout:
        war3.w3mod/... with _locales/<loc>.w3mod/ layers nested inside)
Output: <mirror>/    = flat lowercase tree the web client fetches on demand.

The engine's virtual filesystem merges the base war3.w3mod/ layer with the
locale layer (_locales/enus.w3mod/); the HTTP mirror reproduces that merge
(locale files overwrite base files at the same path) and lowercases every
path, which is what the client's fetch-on-demand requests.
"""
import base64
import os
import shutil
import sys

# Files that are valid UTF-8 with non-ASCII bytes get served mangles by the
# browser's sync-XHR text path (it UTF-8-decodes text-looking bodies, collapsing
# multi-byte chars). Emit a base64 sidecar + an index the client preloads, so
# the engine can fetch exact bytes for those files.
B64_INDEX = "b64.index.txt"


def needs_b64(data):
    if b"\x00" in data:
        return False
    if all(b < 0x80 for b in data):
        return False
    try:
        data.decode("utf-8")
    except UnicodeDecodeError:
        return False
    return True


def files_under(root, exclude_locales=False):
    for dirpath, dirs, files in os.walk(root):
        if exclude_locales:
            dirs[:] = [d for d in dirs if d != "_locales"]
        for f in files:
            yield os.path.join(dirpath, f), os.path.relpath(os.path.join(dirpath, f), root)


def main():
    if len(sys.argv) != 3:
        raise SystemExit("usage: make-mirror.py <extracted-dir> <mirror-dir>")
    extracted, mirror = sys.argv[1], sys.argv[2]
    base = os.path.join(extracted, "war3.w3mod")
    if not os.path.isdir(base):
        raise SystemExit(f"no war3.w3mod/ under {extracted} — wrong layout?")

    n = 0
    b64_paths = []

    def put(src, rel):
        nonlocal n
        dest = os.path.join(mirror, rel.lower())
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        shutil.copyfile(src, dest)
        data = None
        if os.path.getsize(dest) <= 4 * 1024 * 1024:
            try:
                with open(dest, "rb") as f:
                    data = f.read()
            except OSError:
                data = None
        if data is not None and needs_b64(data):
            with open(dest + ".b64", "wb") as f:
                f.write(base64.b64encode(data))
            b64_paths.append(rel.lower())
        n += 1

    # pass 1: the base game layer (excluding the locale subtree)
    for src, rel in files_under(base, exclude_locales=True):
        put(src, rel)

    # pass 2: locale layers — merged over the base, locale wins
    locales = os.path.join(base, "_locales")
    if os.path.isdir(locales):
        for loc in sorted(os.listdir(locales)):
            layer = os.path.join(locales, loc)
            if not os.path.isdir(layer):
                continue
            for src, rel in files_under(layer):
                put(src, rel)

    b64_paths.sort()
    with open(os.path.join(mirror, B64_INDEX), "w") as f:
        f.write("\n".join(b64_paths) + ("\n" if b64_paths else ""))
    print(f"mirror: {n} files -> {mirror} ({len(b64_paths)} base64 sidecars)")


if __name__ == "__main__":
    main()
