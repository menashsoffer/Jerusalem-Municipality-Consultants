#!/usr/bin/env python3
"""Audit extracted supplier rows without changing the source files or database."""

import argparse
import csv
import json
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlparse

REQUIRED_COLUMNS = {'name', 'field', 'registry', 'source_url', 'source_page', 'review_status'}


def normalize_name(value):
    value = unicodedata.normalize('NFKC', value).casefold()
    return ' '.join(re.sub(r'[^\w\s]', ' ', value).split())


def audit(paths):
    sources = defaultdict(lambda: {'rows': 0, 'registries': set(), 'missing': Counter()})
    candidates = defaultdict(list)
    issues = []
    rows_total = 0
    for path in paths:
        with path.open(encoding='utf-8-sig', newline='') as handle:
            reader = csv.DictReader(handle)
            missing_columns = REQUIRED_COLUMNS - set(reader.fieldnames or [])
            if missing_columns:
                raise ValueError(f'{path}: missing columns: {", ".join(sorted(missing_columns))}')
            for line, row in enumerate(reader, start=2):
                rows_total += 1
                source_url = (row.get('source_url') or '').strip()
                name = (row.get('name') or '').strip()
                source = sources[source_url or '(missing)']
                source['rows'] += 1
                source['registries'].add((row.get('registry') or '').strip())
                for field in ('name', 'field', 'registry', 'source_url', 'source_page'):
                    if not (row.get(field) or '').strip():
                        source['missing'][field] += 1
                if not source_url or urlparse(source_url).scheme != 'https':
                    issues.append({'file': str(path), 'line': line, 'issue': 'invalid_source_url'})
                if name and normalize_name(name):
                    candidates[normalize_name(name)].append({
                        'name': name, 'registry': (row.get('registry') or '').strip(),
                        'source_url': source_url, 'source_page': (row.get('source_page') or '').strip(),
                        'file': str(path), 'line': line,
                    })
    groups = []
    for name, entries in sorted(candidates.items()):
        # Repeated rows can represent multiple fields, not distinct businesses.
        if len(entries) > 1:
            groups.append({'normalized_name': name, 'rows': len(entries), 'examples': entries[:5]})
    return {
        'total_rows': rows_total,
        'sources': [{'source_url': url, 'rows': data['rows'],
                     'registries': sorted(data['registries']), 'missing': dict(data['missing'])}
                    for url, data in sorted(sources.items())],
        'duplicate_name_candidates': groups,
        'issues': issues,
        'notice': 'Name matches are review candidates only; no records were merged.',
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('files', nargs='+', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    try:
        result = audit(args.files)
    except (OSError, ValueError, csv.Error) as exc:
        parser.exit(2, f'Import audit failed: {exc}\n')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"Audited {result['total_rows']} rows across {len(result['sources'])} sources; report: {args.output}")


if __name__ == '__main__':
    main()
