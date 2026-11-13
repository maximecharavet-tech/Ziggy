#!/usr/bin/env python3
"""First names in Santa's own voice: the list, the clip JSON and the site index.

    # 1. inputs (open data, downloaded once, not committed):
    #    INSEE "Fichier des prénoms" nat2022.csv (Licence Ouverte 2.0)
    #    US SSA baby names via github.com/hadley/data-baby-names baby-names.csv (public domain)
    python voice-engine/santa_names.py list --insee nat2022.csv --ssa baby-names.csv --out /tmp/name-clips.json
    # 2. record (resumable) with the santa-v2 chain:
    python voice-engine/santa_voice_v2.py --clips /tmp/name-clips.json --models ~/.cache/kokoro \\
        --out public/santa/names --manifest /tmp/names-manifest.json --age 0.7 --mp3-q 6
    # 3. the index the site loads (only names whose two greetings exist):
    python voice-engine/santa_names.py index --clips /tmp/name-clips.json --dir public/santa/names

Slugs follow src/lib/santa/names.ts (nameSlug): lower case, no accents, spaces
and apostrophes -> "-", only a-z and "-".
"""

from __future__ import annotations

import argparse
import collections
import csv
import hashlib
import json
import re
import unicodedata
from pathlib import Path

TEMPLATES = {
    "fr": {"hello": "Bonjour {n} !", "bye": "Joyeux Noël, {n} !"},
    "en": {"hello": "Hello {n}!", "bye": "Merry Christmas, {n}!"},
}
VOICE = "santa-v2"


def slug(s: str) -> str:
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[' ’]+", "-", s)
    s = re.sub(r"[^a-z-]", "", s)
    return re.sub(r"-+", "-", s).strip("-")


def title(n: str) -> str:
    return "-".join(" ".join(w[:1].upper() + w[1:].lower() for w in p.split(" ")) for p in n.split("-"))


def cmd_list(a: argparse.Namespace) -> None:
    c: collections.Counter = collections.Counter()
    for r in csv.DictReader(open(a.insee, encoding="utf-8"), delimiter=";"):
        if r["preusuel"].startswith("_") or not r["annais"].isdigit():
            continue
        if a.fr_from <= int(r["annais"]) <= a.fr_to:
            c[r["preusuel"]] += int(r["nombre"])
    fr: dict[str, str] = {}
    for n, _ in c.most_common():
        s = slug(n)
        if len(s) >= 2 and s not in fr:
            fr[s] = title(n)
        if len(fr) >= a.fr:
            break
    u: collections.Counter = collections.Counter()
    rows = csv.reader(open(a.ssa, encoding="utf-8"))
    next(rows)
    for y, n, p, _sex in rows:
        if int(y) >= a.en_from:
            u[n] += float(p)
    en: dict[str, str] = {}
    for n, _ in u.most_common():
        s = slug(n)
        if len(s) >= 2 and s not in en:
            en[s] = n
        if len(en) >= a.en:
            break
    clips = []
    for loc, names in (("fr", fr), ("en", en)):
        for s, n in names.items():
            for v, tpl in TEMPLATES[loc].items():
                t = tpl.format(n=n)
                clips.append({"locale": loc, "key": f"name:{v}:{n}", "file": f"{v}/{s}", "text": t, "hash": hashlib.sha1(t.encode()).hexdigest()[:10]})
    json.dump(clips, open(a.out, "w", encoding="utf-8"), ensure_ascii=False)
    print(len(fr), "fr names,", len(en), "en names,", len(clips), "clips")


def cmd_index(a: argparse.Namespace) -> None:
    clips = json.load(open(a.clips, encoding="utf-8"))
    out: dict = {"voice": VOICE, "fr": [], "en": []}
    seen: dict = {"fr": set(), "en": set()}
    for c in clips:
        s = c["file"].split("/", 1)[1]
        if s in seen[c["locale"]]:
            continue
        d = Path(a.dir) / c["locale"]
        if all((d / v / f"{s}.mp3").exists() for v in TEMPLATES[c["locale"]]):
            seen[c["locale"]].add(s)
            out[c["locale"]].append(s)
    for loc in ("fr", "en"):
        out[loc].sort()
    Path(a.dir).mkdir(parents=True, exist_ok=True)
    with open(Path(a.dir) / "index.json", "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))
        f.write("\n")
    print(len(out["fr"]), "fr,", len(out["en"]), "en in index")


def main() -> None:
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest="cmd", required=True)
    l = sp.add_parser("list")
    l.add_argument("--insee", required=True)
    l.add_argument("--ssa", required=True)
    l.add_argument("--out", required=True)
    l.add_argument("--fr", type=int, default=2000)
    l.add_argument("--en", type=int, default=800)
    l.add_argument("--fr-from", type=int, default=2010)
    l.add_argument("--fr-to", type=int, default=2022)
    l.add_argument("--en-from", type=int, default=1998)
    i = sp.add_parser("index")
    i.add_argument("--clips", required=True)
    i.add_argument("--dir", default="public/santa/names")
    a = ap.parse_args()
    cmd_list(a) if a.cmd == "list" else cmd_index(a)


if __name__ == "__main__":
    main()
