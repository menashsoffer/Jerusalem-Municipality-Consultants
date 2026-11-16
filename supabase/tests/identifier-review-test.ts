import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACCESS_FIXTURE, SUPPLIER, USERS } from './access-fixture.ts';
import { as, migratedDatabase } from './pglite.ts';

test('identifier lookup is authorized and limited per user', async () => {
  const db = await migratedDatabase();
  try {
    await db.exec(ACCESS_FIXTURE);
    await as(db, USERS.viewer, async () => {
      await assert.rejects(
        db.query('select public.identifier_lookup_authorize()'),
        /Not authorized/,
      );
    });
    await as(db, USERS.editor, async () => {
      for (let i = 0; i < 20; i++) await db.query('select public.identifier_lookup_authorize()');
      await assert.rejects(db.query('select public.identifier_lookup_authorize()'), /Too many/);
    });
    await as(db, USERS.manager, async () => {
      await db.query('select public.identifier_lookup_authorize()');
    });
    await db.exec("update private.call_quota set window_start = now() - interval '2 hours'");
    await as(db, USERS.editor, async () => {
      await db.query('select public.identifier_lookup_authorize()');
    });
  } finally {
    await db.close();
  }
});

test('a candidate requires an explicit decision by a different manager', async () => {
  const db = await migratedDatabase();
  try {
    await db.exec(ACCESS_FIXTURE);
    let id = '';
    await as(db, USERS.editor, async () => {
      const inserted = await db.query<{ id: string; review_status: string }>(
        `insert into public.supplier_identifiers (supplier_id, scheme, value, source)
        values ($1, 'company', '512345679', 'companies_registrar') returning id, review_status`,
        [SUPPLIER],
      );
      id = inserted.rows[0]?.id ?? '';
      assert.equal(inserted.rows[0]?.review_status, 'needs_review');
      await assert.rejects(db.query('select public.decide_supplier_identifier($1, true)', [id]));
    });
    await as(db, USERS.viewer, async () => {
      await assert.rejects(db.query('select public.decide_supplier_identifier($1, true)', [id]));
    });
    await as(db, USERS.manager, async () => {
      const own = await db.query<{ id: string }>(
        `insert into public.supplier_identifiers (supplier_id, scheme, value)
         values ($1, 'company', '512345681') returning id`,
        [SUPPLIER],
      );
      await assert.rejects(
        db.query('select public.decide_supplier_identifier($1, true)', [own.rows[0]?.id]),
      );
    });
    await as(db, USERS.manager, async () => {
      await assert.rejects(
        db.query(
          "update public.supplier_identifiers set review_status = 'verified' where id = $1",
          [id],
        ),
      );
      await db.query('select public.decide_supplier_identifier($1, true)', [id]);
      const row = await db.query<{ review_status: string; verified_by: string }>(
        'select review_status, verified_by from public.supplier_identifiers where id = $1',
        [id],
      );
      assert.equal(row.rows[0]?.review_status, 'verified');
      assert.equal(row.rows[0].verified_by, USERS.manager);
      await assert.rejects(db.query('select public.decide_supplier_identifier($1, true)', [id]));
    });
    await assert.rejects(
      db.query(
        `insert into public.supplier_identifiers (supplier_id, scheme, value, review_status)
      values ($1, 'company', '512345680', 'verified')`,
        [SUPPLIER],
      ),
    );
  } finally {
    await db.close();
  }
});
