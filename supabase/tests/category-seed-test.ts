import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, describe, it } from 'node:test';

import type { PGlite } from '@electric-sql/pglite';

import { applyMigrations, count, migratedDatabase } from './pglite.ts';

const PRIOR = '20261113020000_registry_field_categories.sql';
const SEED = '20261113021000_seed_categories.sql';
const DUPLICATE = '3dfb2369-695b-47ed-9a52-d255a245bfa3';
const KEPT = 'e744ea22-d6d2-4f2f-9ca6-1c77cf148f15';
const LATER = '50000000-0000-0000-0000-0000000000ff';
const MANUAL = '40000000-0000-0000-0000-000000000001';
interface Field {
  id: string;
  registry_id: string;
  source_text: string;
}

describe('reviewed category seed', () => {
  let db: PGlite;
  let fields: Field[];
  before(async () => {
    const fixture = await readFile(
      new URL('./fixtures/category-fields.jsonl', import.meta.url),
      'utf8',
    );
    fields = fixture
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as Field);
    db = await migratedDatabase({ until: PRIOR });
    const registries = [...new Set(fields.map((f) => f.registry_id))];
    for (const [index, id] of registries.entries()) {
      await db.query('insert into public.registries (id, name) values ($1, $2)', [
        id,
        `registry ${String(index)}`,
      ]);
    }
    for (const field of fields) {
      await db.query(
        'insert into public.registry_fields (id, registry_id, source_text) values ($1, $2, $3)',
        [field.id, field.registry_id, field.source_text],
      );
    }
    assert.ok(fields[0]);
    await db.exec(`insert into public.categories (id, name) values ('${MANUAL}', 'Existing manual category');
      insert into public.registry_field_categories (registry_field_id, category_id)
      values ('${fields[0].id}', '${MANUAL}')`);
  });
  after(async () => db.close());

  it('refuses a changed snapshot before adding categories', async () => {
    const first = fields[0];
    assert.ok(first);
    await db.query('update public.registry_fields set source_text = $1 where id = $2', [
      'changed',
      first.id,
    ]);
    await assert.rejects(applyMigrations(db, { after: PRIOR, until: SEED }), /snapshot differs/);
    assert.equal(await count(db, 'select 1 from public.categories'), 1);
    await db.query('update public.registry_fields set source_text = $1 where id = $2', [
      first.source_text,
      first.id,
    ]);
  });

  it('ignores source fields added after the snapshot', async () => {
    await db.query(
      'insert into public.registry_fields (id, registry_id, source_text) values ($1, $2, $3)',
      [LATER, fields[0]?.registry_id, 'field loaded later'],
    );
    await applyMigrations(db, { after: PRIOR, until: SEED });
    assert.equal(
      await count(
        db,
        `select 1 from public.registry_field_categories where registry_field_id = '${LATER}'`,
      ),
      0,
    );
  });

  it('adds the proposed links while preserving existing manual mappings', async () => {
    assert.equal(await count(db, 'select 1 from public.registry_field_categories'), 208);
    assert.equal(
      await count(
        db,
        `select 1 from public.registry_field_categories where category_id = '${MANUAL}'`,
      ),
      1,
    );
    assert.equal(await count(db, 'select 1 from public.categories where parent_id is null'), 10);
    assert.equal(
      await count(db, 'select 1 from public.categories where parent_id is not null'),
      36,
    );
    await applyMigrations(db, { after: PRIOR, until: SEED });
    assert.equal(await count(db, 'select 1 from public.registry_field_categories'), 208);
  });

  it('gives the extraction duplicate the same categories as the field it duplicates', async () => {
    const links = (field: string) =>
      db.query<{ category_id: string }>(
        `select category_id from public.registry_field_categories
         where registry_field_id = $1 order by category_id`,
        [field],
      );
    const [duplicate, kept] = await Promise.all([links(DUPLICATE), links(KEPT)]);
    assert.equal(kept.rows.length, 6);
    assert.deepEqual(duplicate.rows, kept.rows);
  });
});
