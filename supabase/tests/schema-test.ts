import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import type { PGlite } from '@electric-sql/pglite';

import { count, migratedDatabase } from './pglite.ts';

describe('migrations on an empty database', () => {
  let db: PGlite;
  before(async () => {
    db = await migratedDatabase();
  });
  after(async () => {
    await db.close();
  });

  it('enables RLS on every public table', async () => {
    const open = await db.query<{ name: string }>(`
      select c.relname as name from pg_class c
      where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
        and not c.relrowsecurity`);
    assert.deepEqual(open.rows, []);
  });

  it('grants nothing to anon', async () => {
    const grants = `
      select table_name from information_schema.role_table_grants
      where table_schema = 'public' and grantee = 'anon'`;
    assert.equal(await count(db, grants), 0);
  });

  it('indexes every foreign key', async () => {
    const missing = await db.query<{ fk: string }>(`
      select c.conrelid::regclass || '.' || c.conname as fk
      from pg_constraint c
      where c.contype = 'f' and c.connamespace = 'public'::regnamespace
        and not exists (
          select 1 from pg_index i
          where i.indrelid = c.conrelid
            and (i.indkey::int2[])[0:cardinality(c.conkey) - 1] = c.conkey
        )`);
    assert.deepEqual(missing.rows, []);
  });

  it('keeps every helper function out of reach of anon', async () => {
    const callable = `
      select p.proname from pg_proc p
      where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
        and has_function_privilege('anon', p.oid, 'execute')`;
    assert.equal(await count(db, callable), 0);
  });

  it('normalizes Hebrew supplier names', async () => {
    const result = await db.query<{ a: string; b: string }>(`
      select private.normalize_name('חברת "אבג" בע"מ') as a,
        private.normalize_name('חברת אבג  בע״מ') as b`);
    assert.deepEqual(result.rows[0], { a: 'חברת אבג', b: 'חברת אבג' });
  });

  it('rejects overlapping threshold periods', async () => {
    const row = (from: string, until: string) => `
      insert into public.thresholds (valid_from, valid_until, no_tender_max, zuta4_max,
        zuta6_max, source) values ('${from}', '${until}', 1, 2, 3, 'test')`;
    await db.exec(row('2026-10-16', '2026-11-15'));
    await assert.rejects(db.exec(row('2026-11-01', '2026-12-15')));
    await db.exec(row('2026-11-16', '2026-12-15'));
  });
});
