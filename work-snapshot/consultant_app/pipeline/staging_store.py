"""Isolated, review-only storage for extracted municipal source records.

This SQLite store is deliberately separate from both the production Supabase
project and the legacy local prototype. It never modifies its source CSVs.
"""

from __future__ import annotations

import csv
import hashlib
import json
import os
import re
import sqlite3
import unicodedata
from pathlib import Path
from urllib.parse import unquote, urlparse

APP_ID = 0x4A435354  # JCST: refuse to open unrelated SQLite databases.
SCHEMA_VERSION = 1

SCHEMA = '''
CREATE TABLE source_documents (
    id INTEGER PRIMARY KEY,
    media_id TEXT NOT NULL UNIQUE,
    source_url TEXT NOT NULL
);
CREATE TABLE import_files (
    id INTEGER PRIMARY KEY,
    sha256 TEXT NOT NULL UNIQUE,
    original_filename TEXT NOT NULL,
    imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE extracted_records (
    id INTEGER PRIMARY KEY,
    import_file_id INTEGER NOT NULL REFERENCES import_files(id),
    source_document_id INTEGER NOT NULL REFERENCES source_documents(id),
    input_row INTEGER NOT NULL,
    source_page TEXT,
    source_table TEXT,
    source_row TEXT,
    original_name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    original_field TEXT,
    registry_name TEXT,
    phone TEXT,
    phone_office TEXT,
    email TEXT,
    contact TEXT,
    source_number TEXT,
    source_section TEXT,
    review_flags TEXT NOT NULL,
    raw_record_json TEXT NOT NULL,
    review_status TEXT NOT NULL CHECK (review_status = 'needs_review'),
    UNIQUE (import_file_id, input_row)
);
CREATE INDEX extracted_records_name_idx ON extracted_records(normalized_name);
CREATE INDEX extracted_records_source_idx ON extracted_records(source_document_id);
'''


def normalize_name(value: str) -> str:
    value = unicodedata.normalize('NFKC', value).casefold()
    return ' '.join(re.sub(r'[^\w\s]', ' ', value).split())


def source_identifier(url: str) -> str:
    parsed = urlparse(url)
    parts = unquote(parsed.path).strip('/').split('/')
    if (parsed.scheme != 'https' or parsed.hostname not in {'www.jerusalem.muni.il', 'jerusalem.muni.il'}
            or len(parts) < 3 or parts[0] != 'media' or not parts[1]):
        raise ValueError(f'Unexpected municipal source URL: {url!r}')
    return parts[1]


def open_store(path: Path) -> sqlite3.Connection:
    """Create a new store or open only a store previously created by this tool."""
    path = path.resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError:
        created = False
    else:
        os.close(fd)
        created = True
    db = sqlite3.connect(path)
    db.row_factory = sqlite3.Row
    try:
        if created:
            db.executescript(f'PRAGMA application_id={APP_ID}; PRAGMA user_version={SCHEMA_VERSION};\n{SCHEMA}')
        else:
            app_id = db.execute('PRAGMA application_id').fetchone()[0]
            version = db.execute('PRAGMA user_version').fetchone()[0]
            if app_id != APP_ID or version != SCHEMA_VERSION:
                raise ValueError('Refusing to modify an unrelated or unsupported database')
        db.execute('PRAGMA foreign_keys=ON')
        return db
    except Exception:
        db.close()
        if created:
            path.unlink(missing_ok=True)
        raise


def import_csv(db: sqlite3.Connection, path: Path) -> dict:
    """Import a single CSV atomically; a byte-identical file is imported once."""
    payload = path.read_bytes()
    digest = hashlib.sha256(payload).hexdigest()
    if db.execute('SELECT 1 FROM import_files WHERE sha256=?', (digest,)).fetchone():
        return {'file': path.name, 'inserted': 0, 'status': 'already_imported'}
    text = payload.decode('utf-8-sig')
    import io
    reader = csv.DictReader(io.StringIO(text, newline=''))
    required = {'name', 'source_url', 'review_status'}
    if not required.issubset(reader.fieldnames or []):
        raise ValueError(f'{path.name}: required columns missing')
    rows = list(reader)
    if not rows:
        raise ValueError(f'{path.name}: empty import')
    # Validate every row before writing anything; invalid data aborts the file.
    prepared = []
    for number, row in enumerate(rows, start=2):
        if None in row:
            raise ValueError(f'{path.name}:{number}: unexpected columns')
        name = (row.get('name') or '').strip()
        name_key = normalize_name(name)
        url = (row.get('source_url') or '').strip()
        if not name or not name_key or row.get('review_status') != 'needs_review':
            raise ValueError(f'{path.name}:{number}: invalid name or review status')
        prepared.append((number, row, name, name_key, url, source_identifier(url)))
    with db:
        file_id = db.execute('INSERT INTO import_files (sha256, original_filename) VALUES (?, ?)',
                             (digest, path.name)).lastrowid
        for line, row, name, name_key, url, media in prepared:
            db.execute('INSERT INTO source_documents (media_id, source_url) VALUES (?, ?) '
                       'ON CONFLICT (media_id) DO NOTHING', (media, url))
            source_id = db.execute('SELECT id FROM source_documents WHERE media_id=?', (media,)).fetchone()[0]
            values = (file_id, source_id, line, row.get('source_page') or '', row.get('source_table') or '',
                      row.get('source_row') or '', name, name_key, row.get('field') or '',
                      row.get('registry') or '', row.get('phone') or row.get('phone_mobile') or '',
                      row.get('phone_office') or '', row.get('email') or '', row.get('contact') or '',
                      row.get('source_number') or '', row.get('source_section') or '',
                      row.get('review_flags') or '', json.dumps(row, ensure_ascii=False), 'needs_review')
            db.execute('''INSERT INTO extracted_records
                (import_file_id, source_document_id, input_row, source_page, source_table, source_row,
                 original_name, normalized_name, original_field, registry_name, phone, phone_office,
                 email, contact, source_number, source_section, review_flags, raw_record_json, review_status)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''', values)
    return {'file': path.name, 'inserted': len(prepared), 'status': 'imported'}


def summary(db: sqlite3.Connection) -> dict:
    total = db.execute('SELECT COUNT(*) FROM extracted_records').fetchone()[0]
    source_count = db.execute('SELECT COUNT(*) FROM source_documents').fetchone()[0]
    names = db.execute('SELECT COUNT(*) FROM (SELECT normalized_name FROM extracted_records '
                       'GROUP BY normalized_name HAVING COUNT(*) > 1)').fetchone()[0]
    return {'records': total, 'sources': source_count, 'name_review_groups': names,
            'notice': 'Name groups are suggestions for review only; no suppliers were merged.'}


def duplicate_candidates(db: sqlite3.Connection) -> list:
    """Return evidence for same-name records, never merge or assign identities."""
    names = db.execute('SELECT normalized_name, COUNT(*) AS n FROM extracted_records '
                       'GROUP BY normalized_name HAVING COUNT(*) > 1 '
                       'ORDER BY n DESC, normalized_name').fetchall()
    groups = []
    for candidate in names:
        entries = db.execute('''SELECT r.id, r.original_name, r.original_field, r.registry_name,
            r.phone, r.email, r.source_page, r.source_row, d.media_id, d.source_url
            FROM extracted_records r JOIN source_documents d ON d.id = r.source_document_id
            WHERE r.normalized_name = ? ORDER BY d.media_id, r.id''', (candidate['normalized_name'],)).fetchall()
        records = [dict(row) for row in entries]
        emails = [row['email'].strip().casefold() for row in records if row['email'].strip()]
        # Treat multiple numbers in a single field as unknown rather than comparing substrings.
        phones = [re.sub(r'[^0-9]', '', row['phone']) for row in records]
        phones = [number for number in phones if 8 <= len(number) <= 12]
        groups.append({'name_key': candidate['normalized_name'], 'record_count': len(records),
                       'source_count': len({row['media_id'] for row in records}),
                       'shared_email': len(emails) != len(set(emails)),
                       'shared_phone': len(phones) != len(set(phones)),
                       'records': records,
                       'status': 'needs_review'})
    return groups


def field_candidates(db: sqlite3.Connection) -> list:
    """Collect exact source field labels as unapproved taxonomy proposals."""
    result = db.execute('''SELECT original_field, COUNT(*) AS row_count,
        COUNT(DISTINCT source_document_id) AS source_count
        FROM extracted_records WHERE trim(coalesce(original_field, '')) <> ''
        GROUP BY original_field ORDER BY row_count DESC, original_field''').fetchall()
    return [{'source_label': row['original_field'], 'row_count': row['row_count'],
             'source_count': row['source_count'], 'parent_category': None,
             'status': 'needs_review'} for row in result]
