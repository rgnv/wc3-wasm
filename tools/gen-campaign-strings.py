#!/usr/bin/env python3
"""Generate classic-format CampaignStrings files from the Reforged
campaigninfoclassic.txt + the enUS globalstrings table.

The OpenRealm engine reads UI\\CampaignStrings_exp.txt (TFT) and
UI\\CampaignStrings.txt (RoC) in the classic schema:
  [Index] CampaignList="...","..."
  [Section] Header="..", Name="..", Background="..", DefaultOpen=n,
            Cursor=n, IntroCinematic/OpenCinematic/EndCinematic="H","N","movie",
            MissionN="Header","Name","path"
The Reforged data ships the identical schema in ui/campaigninfoclassic.txt,
but Header/Name values are localization KEYS (CAMP_*).  This script resolves
them against the enUS globalstrings.fdf so the engine can display literal text
(it has no campaign-string localization pass).

Usage: gen-campaign-strings.py <campaigninfoclassic.txt> <globalstrings.fdf> <out-dir>
Outputs: <out-dir>/campaignstrings_exp.txt, <out-dir>/campaignstrings.txt
"""
import os
import re
import sys

CRLF = "\r\n"
ROC_CAMPAIGNS = ["Tutorial", "Human", "Undead", "Orc", "NightElf"]

def parse_strings(path):
    table = {}
    with open(path, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            m = re.match(r'^\s+([A-Z0-9_]+)\s+"((?:[^"\\]|\\.)*)",\s*$', line)
            if m:
                table[m.group(1)] = m.group(2).replace('\\"', '"')
    return table

def resolve(value, table, missing):
    if value in table:
        return table[value]
    if re.fullmatch(r"[A-Z0-9_]+", value) and value.startswith("CAMP"):
        missing.add(value)
    return value

def parse_quoted_list(value):
    return re.findall(r'"((?:[^"\\]|\\.)*)"', value)

def main():
    info_path, strings_path, out_dir = sys.argv[1], sys.argv[2], sys.argv[3]
    table = parse_strings(strings_path)
    missing = set()

    sections = {}          # name -> list of (key, raw value)
    order = []
    current = None
    with open(info_path, encoding="utf-8", errors="replace") as fh:
        for raw in fh:
            line = raw.rstrip("\r\n")
            stripped = line.strip()
            if not stripped or stripped.startswith("//"):
                continue
            if stripped.startswith("["):
                current = stripped.strip("[]")
                if current not in sections:
                    sections[current] = []
                    order.append(current)
                continue
            if "=" not in stripped or current is None:
                continue
            key, value = stripped.split("=", 1)
            sections[current].append((key.strip(), value.strip()))

    campaign_order = parse_quoted_list(dict(sections["Index"])["CampaignList"])
    campaign_order = [c for c in campaign_order if c]
    print(f"campaigns in CampaignList: {campaign_order}")

    # sanity: every non-Index section resolves
    body_keys = {"Header", "Name", "Background"}
    for name, kvs in sections.items():
        if name in ("Index", "Label"):
            continue
        for key, value in kvs:
            if key in body_keys or key.startswith("Mission"):
                for q in parse_quoted_list(value):
                    if q.startswith("CAMP"):
                        resolve(q, table, missing)

    def emit(campaigns, out_path):
        lines = ["[Index]"]
        lines.append("CampaignList=" + ",".join('"%s"' % c for c in campaigns))
        lines.append("")
        n_missions = 0
        movies = set()
        for name in campaigns:
            lines.append("[%s]" % name)
            for key, value in sections.get(name, []):
                quoted = parse_quoted_list(value)
                if key in ("Header", "Name", "Background") and len(quoted) == 1:
                    value = '"%s"' % resolve(quoted[0], table, missing)
                elif key.startswith("Mission") and len(quoted) == 3:
                    h, mname, path = (resolve(q, table, missing) for q in quoted)
                    value = '"%s","%s","%s"' % (h, mname, path)
                    n_missions += 1
                elif key in ("IntroCinematic", "OpenCinematic", "EndCinematic"):
                    if len(quoted) >= 3:
                        h = resolve(quoted[0], table, missing)
                        mname = resolve(quoted[1], table, missing)
                        movie_choices = quoted[2:]
                        # Tutorial intro chains BlizzardLogo,TutorialIn,War3Logo;
                        # take the middle one as the meaningful movie for the
                        # engine's single-movie player (chain support pending).
                        movie = movie_choices[len(movie_choices) // 2] if len(movie_choices) > 1 else movie_choices[0]
                        movies.add(movie)
                        value = '"%s","%s","%s"' % (h, mname, movie)
                    elif len(quoted) == 0:
                        value = '""'
                lines.append("%s=%s" % (key, value))
            lines.append("")
        text = CRLF.join(lines) + CRLF
        with open(out_path, "w", encoding="utf-8", newline="") as fh:
            fh.write(text)
        print(f"{out_path}: {len(campaigns)} campaigns, {n_missions} missions, movies={sorted(movies)}")

    os.makedirs(out_dir, exist_ok=True)
    emit(campaign_order, os.path.join(out_dir, "campaignstrings_exp.txt"))
    emit([c for c in ROC_CAMPAIGNS if c in sections], os.path.join(out_dir, "campaignstrings.txt"))

    # cross-checks: stage/movie presence
    loose = os.environ.get("WC3_CAMPAIGN_HEADERS", "")
    movies_web = os.environ.get("WC3_CAMPAIGN_MOVIES", "")
    problems = 0
    for name in campaign_order:
        for key, value in sections.get(name, []):
            if key.startswith("Mission"):
                q = parse_quoted_list(value)
                if len(q) == 3:
                    p = q[2].lower().replace("campaign/classic/", "")
                    if not os.path.exists(os.path.join(loose, p)):
                        print("MISSING MAP: %s" % q[2]); problems += 1
    else_names = set()
    for name in campaign_order:
        for key, value in sections.get(name, []):
            if key in ("IntroCinematic", "OpenCinematic", "EndCinematic"):
                q = parse_quoted_list(value)
                if len(q) >= 3:
                    for mv in q[2:]:
                        if not any(os.path.exists(os.path.join(movies_web, f"{mv.lower()}_{tier}.webm")) for tier in ("640", "1280")):
                            print("MISSING MOVIE: %s" % mv); problems += 1
    if missing:
        print("UNRESOLVED KEYS: %s" % sorted(missing)); problems += len(missing)
    print("problems: %d" % problems)
    return 1 if problems else 0

if __name__ == "__main__":
    sys.exit(main())
