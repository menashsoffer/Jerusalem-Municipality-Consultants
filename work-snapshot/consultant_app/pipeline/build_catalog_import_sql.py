#!/usr/bin/env python3
"""Build a private, transactional import script for the normalized catalog.

The generated SQL is not executed by this program. It contains source data;
never commit it or store it in a public directory.
"""
import argparse
import hashlib
import json
import os
import re
import uuid
from pathlib import Path

from prepare_catalog_import import stable_id


def validated_package(path):
    package = json.loads(path.read_text(encoding='utf-8'))
    digest = package.pop('package_sha256')
    canonical = json.dumps(package, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()
    if package.get('format') != 'municipal-catalog-review-v1' or hashlib.sha256(canonical).hexdigest() != digest:
        raise ValueError('Package format or checksum mismatch')
    return package


def source_payload(source):
    fields = {}
    for row in source['records']:
        name = row['field'].strip()
        if name:
            key = name.lower()
            fields.setdefault(key, {'id': stable_id('field', source['registry_id'], key), 'name': name})
            row['field_id'] = fields[key]['id']
        else:
            row['field_id'] = None
        raw = row['raw']
        contacts = []
        # OCR contact values require individual review before being displayed.
        if 'ocr_scan_verify_every_field' not in row['review_flags']:
            for kind, keys in [('email', ('email',)), ('phone', ('phone', 'phone_mobile', 'phone_office'))]:
                for key in keys:
                    value = str(raw.get(key) or '').strip()
                    values = re.split(r'\s*[/;]\s*', value) if kind == 'phone' else [value]
                    for part in values:
                        if part and len(part) <= 500 and (kind, part) not in contacts:
                            contacts.append((kind, part))
        row['contacts'] = [{'kind': kind, 'value': value} for kind, value in contacts]
        # Source cells can contain personal or ambiguous identifiers. Keep the
        # complete extraction in the private review store, while uploading only
        # the published catalog fields and the coordinates needed to find it.
        allowed = ('name', 'field', 'phone', 'phone_mobile', 'phone_office', 'email',
                   'registry', 'source_url', 'source_page', 'source_table', 'source_row',
                   'review_flags', 'review_status')
        row['raw'] = {key: raw[key] for key in allowed if key in raw}
    source['fields'] = list(fields.values())
    return source


SQL = r'''-- Generated locally; review source data and back up before use.
-- Each source is imported exactly once or the entire transaction rolls back.
begin;
do $import$
declare s jsonb; r jsonb; f jsonb; c jsonb; iid bigint; rid uuid; n integer;
begin
 for s in select value from jsonb_array_elements(PAYLOAD::jsonb) loop
  if exists (select 1 from public.import_batches where id = (s->>'batch_id')::uuid) then
   select count(*) into n from public.import_rows where batch_id = (s->>'batch_id')::uuid;
   if n <> jsonb_array_length(s->'records') then raise exception 'Existing batch has a different row count: %', s->>'media_id'; end if;
   if exists (
    select 1 from jsonb_array_elements(s->'records') expected
    where not exists (
     select 1 from public.import_rows ir join public.memberships m on m.import_row_id = ir.id
      join public.suppliers sp on sp.id = m.supplier_id
     where ir.batch_id = (s->>'batch_id')::uuid
      and ir.row_number = (expected->>'input_row')::int
      and ir.raw->>'row_key' = expected->>'row_key'
      and sp.id = (expected->>'supplier_id')::uuid
      and m.registry_version_id = (s->>'version_id')::uuid
    )
   ) then raise exception 'Existing batch is incomplete or inconsistent: %', s->>'media_id'; end if;
   continue;
  end if;
  if exists (select 1 from public.source_documents where id = (s->>'document_id')::uuid
              or position('/media/' || (s->>'media_id') || '/' in url) > 0)
     or exists (select 1 from public.registries where id = (s->>'registry_id')::uuid
                 or lower(trim(name)) = lower(trim(s->>'registry_name'))) then
   raise exception 'Source or registry already exists; reconcile before import: %', s->>'media_id';
  end if;
  insert into public.source_documents (id, url, note)
   values ((s->>'document_id')::uuid, s->>'url', 'מקור משויך לקובץ מקומי; נדרש אימות מול הפרסום');
  insert into public.registries (id, name, keeper, status)
   values ((s->>'registry_id')::uuid, s->>'registry_name', 'municipality', 'unknown');
  insert into public.registry_versions (id, registry_id, source_document_id)
   values ((s->>'version_id')::uuid, (s->>'registry_id')::uuid, (s->>'document_id')::uuid);
  insert into public.import_batches (id, source_document_id, registry_id, registry_version_id, script_name, script_version, row_count, status, note)
   values ((s->>'batch_id')::uuid, (s->>'document_id')::uuid, (s->>'registry_id')::uuid,
    (s->>'version_id')::uuid, 'review_package_import', '1', jsonb_array_length(s->'records'), 'in_review', s->>'input_sha256');
  for f in select value from jsonb_array_elements(s->'fields') loop
   insert into public.registry_fields (id, registry_id, source_text)
    values ((f->>'id')::uuid, (s->>'registry_id')::uuid, f->>'name');
  end loop;
  for r in select value from jsonb_array_elements(s->'records') loop
   insert into public.import_rows (batch_id, row_number, source_page, raw, status)
    values ((s->>'batch_id')::uuid, (r->>'input_row')::int, (r->>'source_page')::int,
     jsonb_build_object('row_key', r->>'row_key', 'source_table', r->>'source_table',
      'source_row', r->>'source_row', 'review_flags', r->>'review_flags', 'record', r->'raw'), 'promoted') returning id into iid;
   insert into public.suppliers (id, display_name, note)
    values ((r->>'supplier_id')::uuid, r->>'name', 'חילוץ אוטומטי; הזהות והפרטים דורשים בדיקה מול המקור');
   insert into public.supplier_names (supplier_id, name, source_document_id)
    values ((r->>'supplier_id')::uuid, r->>'name', (s->>'document_id')::uuid);
   insert into public.memberships (supplier_id, registry_version_id, registry_field_id, name_as_published, source_page, import_row_id, note)
    values ((r->>'supplier_id')::uuid, (s->>'version_id')::uuid, (r->>'field_id')::uuid,
     r->>'name', (r->>'source_page')::int, iid, nullif(r->>'review_flags', ''));
   for c in select value from jsonb_array_elements(r->'contacts') loop
    insert into public.supplier_contacts (supplier_id, kind, value, source_document_id, status)
     values ((r->>'supplier_id')::uuid, c->>'kind', c->>'value', (s->>'document_id')::uuid, 'disputed')
     on conflict do nothing;
   end loop;
  end loop;
 end loop;
end $import$;
commit;
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('package', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    package = validated_package(args.package)
    sources = [source_payload(s) for s in package['sources'] if s['listing_kind'] == 'supplier']
    for source in sources:
        for key in ('batch_id', 'document_id', 'registry_id', 'version_id'):
            uuid.UUID(source[key])
    payload = json.dumps(sources, ensure_ascii=False, separators=(',', ':')).replace("'", "''")
    sql = SQL.replace('PAYLOAD', "'" + payload + "'")
    fd = os.open(args.output, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, 'w', encoding='utf-8') as handle:
        handle.write(sql)
    print(f"Prepared SQL for {sum(len(s['records']) for s in sources)} supplier rows from {len(sources)} sources. Venue listings remain separate. Nothing was executed.")


if __name__ == '__main__':
    main()
