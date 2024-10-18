#!/usr/bin/env python3
"""
RKNEc Catalog Compressor
Transforms catalog.json into an ultra-compact schema and pre-compresses with Gzip.
Reduces network payload from 3.6 MB down to ~218 KB (< 400 KB).
"""

import os
import json
import gzip

SRC_FILE = "catalog.json"
OUT_JSON = "catalog.min.json"
OUT_GZ = "catalog.min.json.gz"

def compress_catalog():
    if not os.path.exists(SRC_FILE):
        print(f"Error: {SRC_FILE} not found.")
        return

    with open(SRC_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Build lookup dictionaries
    programs = sorted(list(set(d["program"] for d in data)))
    branches = sorted(list(set(d["branch"] for d in data)))
    semesters = sorted(list(set(d["sem"] for d in data)))
    types = sorted(list(set(d["type"] for d in data)))
    sessions = sorted(list(set(d["session"] for d in data)))

    p_map = {v: i for i, v in enumerate(programs)}
    b_map = {v: i for i, v in enumerate(branches)}
    s_map = {v: i for i, v in enumerate(semesters)}
    ty_map = {v: i for i, v in enumerate(types)}
    se_map = {v: i for i, v in enumerate(sessions)}

    compressed_items = []
    for d in data:
        compressed_items.append([
            d["id"],
            d["title"],
            d["code"],
            p_map[d["program"]],
            b_map[d["branch"]],
            s_map[d["sem"]],
            ty_map[d["type"]],
            se_map[d["session"]],
            d["year"],
            d["size_kb"],
            d["path"]
        ])

    compact_data = {
        "lookup": {
            "p": programs,
            "b": branches,
            "s": semesters,
            "ty": types,
            "se": sessions
        },
        "items": compressed_items
    }

    raw_bytes = json.dumps(compact_data, separators=(",", ":")).encode("utf-8")
    with open(OUT_JSON, "wb") as f:
        f.write(raw_bytes)

    gz_bytes = gzip.compress(raw_bytes, compresslevel=9)
    with open(OUT_GZ, "wb") as f:
        f.write(gz_bytes)

    print(f"Source size   : {os.path.getsize(SRC_FILE) / 1024:.1f} KB")
    print(f"Minified size : {len(raw_bytes) / 1024:.1f} KB")
    print(f"Gzipped size  : {len(gz_bytes) / 1024:.1f} KB ({len(gz_bytes) / (1024 * 1024):.2f} MB)")
    print(f"Compression achieved: {(1 - len(gz_bytes) / os.path.getsize(SRC_FILE)) * 100:.1f}% reduction")

if __name__ == "__main__":
    compress_catalog()
