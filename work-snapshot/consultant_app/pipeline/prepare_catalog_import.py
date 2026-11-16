#!/usr/bin/env python3
"""Prepare an offline, review-only JSON package for the new catalog importer.

This does not connect to Supabase. The output may contain personal contact
details and must not be committed or placed in a public website directory.
"""
import argparse
import hashlib
import json
import os
import sqlite3
import uuid
from collections import defaultdict
from pathlib import Path

from staging_store import APP_ID, SCHEMA_VERSION

NAMESPACE = uuid.UUID('60705579-6b1e-4a85-9a0e-77db7bb46708')
LEGACY_FILES = {'suppliers_import.csv', 'additional_import.csv'}


def stable_id(*parts):
    return str(uuid.uuid5(NAMESPACE, json.dumps(parts, ensure_ascii=False, separators=(',', ':'))))


def prepare(path):
    uri = path.resolve().as_uri() + '?mode=ro'
    with sqlite3.connect(uri, uri=True) as db:
        db.row_factory = sqlite3.Row
        if db.execute('PRAGMA application_id').fetchone()[0] != APP_ID or db.execute('PRAGMA user_version').fetchone()[0] != SCHEMA_VERSION:
            raise ValueError('Not a supported review database')
        data = db.execute('''select r.*, d.media_id, d.source_url, f.original_filename, f.sha256
            from extracted_records r join source_documents d on d.id = r.source_document_id
            join import_files f on f.id = r.import_file_id order by d.media_id, f.sha256, r.input_row''').fetchall()
    grouped = defaultdict(list)
    legacy_sources = {row['media_id'] for row in data if row['original_filename'] in LEGACY_FILES}
    for row in data:
        if row['original_filename'] not in LEGACY_FILES:
            if row['media_id'] in legacy_sources:
                raise ValueError(f"{row['media_id']}: source also exists in legacy import; reconcile first")
            grouped[row['media_id']].append(row)
    sources = []
    for media_id, rows in sorted(grouped.items()):
        files = {r['sha256'] for r in rows}
        urls = {r['source_url'] for r in rows}
        registries = {r['registry_name'] for r in rows}
        if len(files) != 1 or len(urls) != 1 or len(registries) != 1 or not next(iter(registries)):
            raise ValueError(f'{media_id}: ambiguous source file, URL, or registry')
        file_hash = next(iter(files))
        batch_id = stable_id('batch', media_id, file_hash)
        records = []
        for row in rows:
            raw = json.loads(row['raw_record_json'])
            source_row_key = stable_id('row', batch_id, row['input_row'])
            records.append({'row_key': source_row_key, 'input_row': row['input_row'],
                            'supplier_id': stable_id('supplier', source_row_key),
                            'name': row['original_name'], 'field': row['original_field'] or '',
                            'source_page': int(row['source_page']) if row['source_page'].isdigit() else None,
                            'source_table': row['source_table'], 'source_row': row['source_row'],
                            'review_flags': row['review_flags'], 'raw': raw})
        if len({r['row_key'] for r in records}) != len(records):
            raise ValueError(f'{media_id}: duplicate row keys')
        sources.append({'media_id': media_id, 'url': next(iter(urls)), 'registry_name': next(iter(registries)),
                        'input_file': rows[0]['original_filename'], 'input_sha256': file_hash,
                        'batch_id': batch_id, 'document_id': stable_id('document', media_id),
                        'registry_id': stable_id('registry', media_id),
                        'version_id': stable_id('version', media_id),
                        'listing_kind': 'venue' if media_id == '5sadsxmp' else 'supplier',
                        'records': records})
    payload = {'format': 'municipal-catalog-review-v1', 'sources': sources}
    canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()
    payload['package_sha256'] = hashlib.sha256(canonical).hexdigest()
    return payload


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    package = prepare(args.db)
    fd = os.open(args.output, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, 'w', encoding='utf-8') as handle:
        json.dump(package, handle, ensure_ascii=False, indent=2)
        handle.write('\n')
    print(f"Prepared {sum(len(s['records']) for s in package['sources'])} source rows from {len(package['sources'])} sources; no database or website changed.")


if __name__ == '__main__':
    main()
