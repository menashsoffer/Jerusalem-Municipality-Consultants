#!/usr/bin/env python3
"""Reconcile a municipal publication snapshot with extracted import rows."""

import argparse
import csv
import hashlib
import json
from collections import Counter
from pathlib import Path
from urllib.parse import quote, unquote, urlparse

MUNICIPAL_MEDIA = 'https://www.jerusalem.muni.il/media/'


def media_id(url):
    path = unquote(urlparse(url).path)
    parts = path.strip('/').split('/')
    return parts[1] if len(parts) >= 3 and parts[0] == 'media' else None


def reconcile(catalog, imports, local_manifest=None, workspace=None, staging=None):
    imported = Counter()
    for path in imports:
        with path.open(encoding='utf-8-sig', newline='') as handle:
            for row in csv.DictReader(handle):
                identifier = media_id(row.get('source_url', ''))
                if identifier:
                    imported[identifier] += 1
    staged = Counter()
    for path in staging or []:
        with path.open(encoding='utf-8-sig', newline='') as handle:
            reader = csv.DictReader(handle)
            if not {'source_url', 'review_status'} <= set(reader.fieldnames or []):
                raise ValueError(f'Staging file missing source_url or review_status: {path}')
            for row in reader:
                if row['review_status'] != 'needs_review':
                    raise ValueError(f'Unexpected status in staging file: {path}')
                identifier = media_id(row.get('source_url', ''))
                if not identifier:
                    raise ValueError(f'Invalid staging source URL: {path}')
                staged[identifier] += 1
    with catalog.open(encoding='utf-8', newline='') as handle:
        rows = list(csv.DictReader(handle, delimiter='\t', quoting=csv.QUOTE_NONE))
    local = {}
    if local_manifest is not None:
        if workspace is None:
            raise ValueError('Workspace is required with a local manifest')
        root = workspace.resolve()
        with local_manifest.open(encoding='utf-8', newline='') as handle:
            for candidate in csv.DictReader(handle, delimiter='\t'):
                relative = candidate['local_file']
                path = (root / relative).resolve()
                if not path.is_relative_to(root):
                    raise ValueError(f'Local path outside workspace: {relative}')
                exists = path.is_file()
                digest = None
                if exists:
                    hasher = hashlib.sha256()
                    with path.open('rb') as file_handle:
                        for chunk in iter(lambda: file_handle.read(1024 * 1024), b''):
                            hasher.update(chunk)
                    digest = hasher.hexdigest()
                local.setdefault(candidate['media_id'], []).append({
                    'local_file': relative, 'basis': candidate['basis'],
                    'exists': exists, 'sha256': digest,
                    'match_status': 'source_link_verified' if candidate['basis'] == 'downloaded_from_municipal_link'
                                    else 'candidate_needs_content_verification',
                })
    seen = set()
    result = []
    for row in rows:
        media_path = row['media_path'].strip()
        if '/' not in media_path or media_path.startswith('/') or '..' in media_path.split('/'):
            raise ValueError(f'Invalid media path: {media_path!r}')
        identifier = media_path.split('/')[0]
        if identifier in seen:
            raise ValueError(f'Duplicate media identifier: {identifier}')
        seen.add(identifier)
        result.append({**row, 'source_url': MUNICIPAL_MEDIA + quote(media_path, safe='/'),
                       'imported_rows': imported[identifier], 'staged_rows': staged[identifier],
                       'local_candidates': local.get(identifier, []),
                       'import_status': 'rows_extracted_unverified' if imported[identifier] else 'not_in_import_files'})
    return {'publication_count': len(result), 'publications': result,
            'unmatched_import_media_ids': sorted(set(imported) - seen),
            'unmatched_staging_media_ids': sorted(set(staged) - seen),
            'notice': 'Import counts do not establish completeness, validity, or database contents.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--catalog', type=Path, required=True)
    parser.add_argument('--imports', type=Path, nargs='+', required=True)
    parser.add_argument('--staging', type=Path, nargs='*', default=[])
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--local-manifest', type=Path)
    parser.add_argument('--workspace', type=Path)
    args = parser.parse_args()
    try:
        report = reconcile(args.catalog, args.imports, args.local_manifest, args.workspace, args.staging)
    except (OSError, ValueError, csv.Error) as exc:
        parser.exit(2, f'Catalog reconciliation failed: {exc}\n')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"Catalogued {report['publication_count']} publications; report: {args.output}")


if __name__ == '__main__':
    main()
