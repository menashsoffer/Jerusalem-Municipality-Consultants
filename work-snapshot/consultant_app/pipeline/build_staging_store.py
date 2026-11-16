#!/usr/bin/env python3
"""Build a review-only database in an isolated local path."""

import argparse
import json
from pathlib import Path

from staging_store import import_csv, open_store, summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', type=Path, required=True)
    parser.add_argument('files', type=Path, nargs='+')
    args = parser.parse_args()
    with open_store(args.db) as db:
        imports = [import_csv(db, path) for path in args.files]
        print(json.dumps({'imports': imports, 'summary': summary(db)}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
