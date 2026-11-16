#!/usr/bin/env python3
"""Generate a local review report; matching records are never merged."""

import argparse
import json
from pathlib import Path

from staging_store import duplicate_candidates, open_store


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if not args.db.is_file():
        parser.error('Review database does not exist')
    with open_store(args.db) as db:
        groups = duplicate_candidates(db)
    report = {'notice': 'Suggestions only. Repeated names can represent different suppliers or distinct fields.',
              'groups': groups}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('x', encoding='utf-8') as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)
        handle.write('\n')
    print(f'{len(groups)} candidate groups for review: {args.output}')


if __name__ == '__main__':
    main()
