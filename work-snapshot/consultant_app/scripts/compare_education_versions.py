#!/usr/bin/env python3
"""Compare extracted name/field pairs without merging supplier identities."""
import argparse
import collections
import csv
import hashlib
import json
import unicodedata
from pathlib import Path


def normalized(value):
    return ' '.join(unicodedata.normalize('NFKC', value).split())


def read(path, media_id):
    with path.open(encoding='utf-8-sig', newline='') as handle:
        return [r for r in csv.DictReader(handle) if f'/{media_id}/' in r['source_url']]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('old', type=Path)
    parser.add_argument('new', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    old, new = read(args.old, 'lymhcxle'), read(args.new, 'tecnwz4z')
    if len(old) != 210 or len(new) != 210:
        raise ValueError('Unexpected source row count')
    pair = lambda r: (normalized(r['name']), normalized(r['field']))
    a, b = collections.Counter(map(pair, old)), collections.Counter(map(pair, new))
    report = {'older_media_id': 'lymhcxle', 'newer_media_id': 'tecnwz4z',
              'older_file_sha256': hashlib.sha256(args.old.read_bytes()).hexdigest(),
              'newer_file_sha256': hashlib.sha256(args.new.read_bytes()).hexdigest(),
              'older_rows': len(old), 'newer_rows': len(new),
              'matching_name_and_field_rows': sum((a & b).values()),
              'older_only_name_and_field_rows': sum((a - b).values()),
              'newer_only_name_and_field_rows': sum((b - a).values()),
              'note': 'Exact extracted name/field comparison only; not a supplier identity or current-status decision.'}
    with args.output.open('x', encoding='utf-8') as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)
        handle.write('\n')
    print('Compared extracted versions; identities and differences require review.')


if __name__ == '__main__':
    main()
