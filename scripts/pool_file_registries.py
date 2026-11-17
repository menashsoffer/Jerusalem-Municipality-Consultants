"""Turn a consolidated pool workbook into one input file per registry for
public.import_pool_registry.

Run: python3 scripts/pool_file_registries.py <workbook.xlsx> <output-dir> [--skip NAME ...]

Every registry in the sheet of source rows becomes data/<NN>.json, except halls (which
have no model yet) and the registries named with --skip (those already on the site,
and older versions of them). Each row keeps the consolidated supplier key, so that the
database can link the same supplier across registries. Numbers with a wrong check
digit are left out, and every number stays a candidate until a person accepts it.
"""

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import unquote

from openpyxl import load_workbook
from pool_file_identifiers import (
    NAME,
    NUMBER,
    PUBLISHED_NAME,
    ROWS_SHEET,
    SUPPLIER_KEY,
    SUPPLIERS_SHEET,
    check_digit_ok,
    scheme_of,
    sheet_rows,
    text,
)

POOL = "מאגר"
FIELD = "תחום / תת־תחום"
KIND = "סוג רשומה"
STATE = "מצב המקור"
LINK = "קישור למקור"
PAGE = "עמוד מקור"
PHONES = ("טלפון ראשי", "טלפון נוסף")
EMAIL = "דוא״ל"
PERSON = "איש קשר"
ADDRESS = "כתובת"
LOADED_ON = "17.11.2026"


def is_hall(row):
    return "אולם" in text(row.get(KIND))


def phones(row):
    found = []
    for column in PHONES:
        value = text(row.get(column))
        if len(re.sub(r"\D", "", value)) >= 9 and value not in found:
            found.append(value)
    return found


def emails(row):
    return [e for e in re.split(r"[\s;,]+", text(row.get(EMAIL)).lower()) if "@" in e]


def number(row):
    digits = re.sub(r"\D", "", text(row.get(NUMBER)))
    if not digits or len(digits) > 9 or not check_digit_ok(digits):
        return {}
    value = digits.zfill(9)
    return {"scheme": scheme_of(value), "value": value}


def page(row):
    value = row.get(PAGE)
    return int(value) if isinstance(value, int | float) and value > 0 else None


def entry(row, canonical):
    key = text(row.get(SUPPLIER_KEY))
    name = canonical.get(key) or text(row.get(NAME))
    published = text(row.get(PUBLISHED_NAME)) or text(row.get(NAME))
    names = list(dict.fromkeys(n for n in (name, text(row.get(NAME)), published) if n))
    item = {
        "key": key,
        "name": name,
        "names": names,
        "published_name": published,
        "field": text(row.get(FIELD)),
        "page": page(row),
        "phones": phones(row),
        "emails": emails(row),
        "address": text(row.get(ADDRESS)) or None,
        "person": text(row.get(PERSON)) or None,
        **number(row),
    }
    return {k: v for k, v in item.items() if v not in (None, "", [])}


def registry(name, rows, canonical):
    url = Counter(text(r.get(LINK)) for r in rows).most_common(1)[0][0]
    state = Counter(text(r.get(STATE)) for r in rows).most_common(1)[0][0]
    return {
        "name": name,
        "status": "closed" if "היסטורית" in state else "unknown",
        "note": f"נטען מקובץ המאגר המאוחד ({LOADED_ON}). מצב המקור בקובץ: {state}.",
        "url": url,
        "file_name": unquote(url.rsplit("/", 1)[-1])[:300],
        "rows": [entry(r, canonical) for r in rows],
    }


def build(workbook, skip=()):
    """Returns one registry dict per registry in the file, in order of appearance."""
    canonical = {
        text(r.get(SUPPLIER_KEY)): text(r.get(NAME)) for r in sheet_rows(workbook, SUPPLIERS_SHEET)
    }
    pools = defaultdict(list)
    for row in sheet_rows(workbook, ROWS_SHEET):
        name = text(row.get(POOL))
        if name and name not in skip and not is_hall(row) and text(row.get(NAME)):
            pools[name].append(row)
    return [registry(name, rows, canonical) for name, rows in pools.items()]


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("workbook")
    parser.add_argument("output")
    parser.add_argument("--skip", action="append", default=[])
    args = parser.parse_args()
    book = load_workbook(args.workbook, read_only=True, data_only=True)
    registries = build(book, set(args.skip))
    out = Path(args.output)
    out.mkdir(parents=True, exist_ok=True)
    for index, item in enumerate(registries, 1):
        path = out / f"{index:02d}.json"
        path.write_text(json.dumps(item, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"{path.name}: {item['name']} ({len(item['rows'])} rows)", file=sys.stderr)


if __name__ == "__main__":
    main()
