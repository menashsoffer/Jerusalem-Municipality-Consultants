#!/usr/bin/env python3
"""Report source field names without approving or inventing categories."""

import argparse
import json
from pathlib import Path
from staging_store import field_candidates, open_store


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if not args.db.is_file():
        parser.error('Review database does not exist')
    with open_store(args.db) as db:
        fields = field_candidates(db)
    report = {'notice': 'Source labels are proposals only; parent categories are not inferred.', 'fields': fields}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('x', encoding='utf-8') as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)
        handle.write('\n')
    print(f'{len(fields)} source field labels for review: {args.output}')


if __name__ == '__main__':
    main()
