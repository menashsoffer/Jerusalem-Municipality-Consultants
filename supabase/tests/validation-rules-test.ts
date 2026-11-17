import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import type { PGlite } from '@electric-sql/pglite';

import { RULE_CASES } from '../../web/src/lib/rules/tests/rule-cases.ts';
import { ACCESS_FIXTURE, SUPPLIER, UNIT_1, USERS, VERSION } from './access-fixture.ts';
import { as, migratedDatabase } from './pglite.ts';

async function rejection(db: PGlite, sql: string, params: unknown[] = []): Promise<string> {
  try {
    await db.query(sql, params);
    return '';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

describe('validation rules in the database', () => {
  let db: PGlite;
  before(async () => {
    db = await migratedDatabase();
    await db.exec(ACCESS_FIXTURE);
  });
  after(async () => {
    await db.close();
  });

  it('reports the same rule key as the site for every shared case', async () => {
    for (const [rule, value, expected] of RULE_CASES) {
      const result = await db.query<{ key: string | null }>(
        "select private.rule_problem($1, $2, date '2026-11-17') as key",
        [rule, value],
      );
      assert.equal(result.rows[0]?.key ?? null, expected, `${rule}: ${value}`);
    }
  });

  it('refuses junk contacts and names from a signed-in editor', async () => {
    await as(db, USERS.admin, async () => {
      const contact = 'select public.replace_supplier_contact($1::jsonb)';
      const phone = JSON.stringify({ supplier_id: SUPPLIER, kind: 'phone', value: 'שטויות' });
      assert.equal(await rejection(db, contact, [phone]), 'invalid:bad_phone');
      const good = JSON.stringify({ supplier_id: SUPPLIER, kind: 'phone', value: '02-6297777' });
      assert.equal(await rejection(db, contact, [good]), '');
      const rename = 'select public.rename_supplier($1::jsonb)';
      const name = JSON.stringify({ supplier_id: SUPPLIER, display_name: '12345' });
      assert.equal(await rejection(db, rename, [name]), 'invalid:needs_letters');
    });
  });

  it('refuses a bad status reason, a future date and reversed membership dates', async () => {
    await as(db, USERS.admin, async () => {
      const status = 'select public.set_supplier_status($1::uuid, $2::jsonb)';
      const change = { active: false, reason: '...', changedOn: '2026-01-01' };
      assert.equal(
        await rejection(db, status, [SUPPLIER, JSON.stringify(change)]),
        'invalid:needs_letters',
      );
      const future = { ...change, reason: 'החברה פורקה', changedOn: '2999-01-01' };
      assert.equal(
        await rejection(db, status, [SUPPLIER, JSON.stringify(future)]),
        'invalid:date_range',
      );
      const insert = `insert into public.memberships (supplier_id, registry_version_id,
        registered_from, registered_until) values ($1::uuid, $2::uuid, '2025-01-01', '2024-01-01')`;
      assert.equal(await rejection(db, insert, [SUPPLIER, VERSION]), 'invalid:dates_order');
    });
  });

  it('refuses a company number with a wrong check digit', async () => {
    await as(db, USERS.admin, async () => {
      const insert = `insert into public.supplier_identifiers (supplier_id, scheme, value)
        values ($1::uuid, 'company', '512679904')`;
      assert.equal(await rejection(db, insert, [SUPPLIER]), 'invalid:bad_check_digit');
    });
  });

  it('leaves imports without a signed-in user to their source text', async () => {
    const insert = `insert into public.supplier_contacts (supplier_id, kind, value)
      values ($1::uuid, 'phone', '02-6297111 שלוחה 3')`;
    assert.equal(await rejection(db, insert, [SUPPLIER]), '');
  });
});

describe('one save for the edit dialog', () => {
  let db: PGlite;
  before(async () => {
    db = await migratedDatabase();
    await db.exec(ACCESS_FIXTURE);
  });
  after(async () => {
    await db.close();
  });
  const update = 'select public.update_supplier($1::jsonb)';

  it('stores the name and contacts together, or nothing when one part is wrong', async () => {
    await as(db, USERS.admin, async () => {
      const bad = {
        supplier_id: SUPPLIER,
        display_name: 'שם חדש לגמרי',
        contacts: [
          { contact_id: '', kind: 'email', value: 'office@example.co.il' },
          { contact_id: '', kind: 'phone', value: '123' },
        ],
      };
      assert.equal(await rejection(db, update, [JSON.stringify(bad)]), 'invalid:bad_phone');
      const names = await db.query('select 1 from public.suppliers where display_name = $1', [
        'שם חדש לגמרי',
      ]);
      assert.equal(names.rows.length, 0);
      const good = { ...bad, contacts: [{ contact_id: '', kind: 'phone', value: '02-6297777' }] };
      assert.equal(await rejection(db, update, [JSON.stringify(good)]), '');
      const stored = await db.query<{ value: string }>(
        "select value from public.supplier_contacts where supplier_id = $1::uuid and kind = 'phone'",
        [SUPPLIER],
      );
      assert.deepEqual(
        stored.rows.map((row) => row.value),
        ['02-6297777'],
      );
    });
  });

  it('refuses unknown fields and anyone who may not edit the supplier', async () => {
    const extra = JSON.stringify({ supplier_id: SUPPLIER, contacts: [], note: 'x' });
    await as(db, USERS.admin, async () => {
      assert.equal(await rejection(db, update, [extra]), 'Invalid supplier input');
    });
    const rename = JSON.stringify({ supplier_id: SUPPLIER, display_name: 'שם אחר', contacts: [] });
    await as(db, USERS.viewer, async () => {
      assert.notEqual(await rejection(db, update, [rename]), '');
    });
  });
});

describe('request and note rules', () => {
  let db: PGlite;
  before(async () => {
    db = await migratedDatabase();
    await db.exec(ACCESS_FIXTURE);
  });
  after(async () => {
    await db.close();
  });

  it('refuses a junk subject or a zero estimate for an engagement request', async () => {
    const create = 'select public.create_engagement_request($1::jsonb)';
    const draft = {
      unit_id: UNIT_1,
      subject: 'ייעוץ ארגוני',
      estimated_value: 100000,
      value_includes_vat: false,
      requested_exemption: null,
    };
    await as(db, USERS.admin, async () => {
      const junk = JSON.stringify({ ...draft, subject: '1234' });
      assert.equal(await rejection(db, create, [junk]), 'invalid:needs_letters');
      const zero = JSON.stringify({ ...draft, estimated_value: 0 });
      assert.equal(await rejection(db, create, [zero]), 'invalid:bad_amount');
      assert.equal(await rejection(db, create, [JSON.stringify(draft)]), '');
    });
  });

  it('refuses a review note that says nothing', async () => {
    await as(db, USERS.admin, async () => {
      const decide = "select public.decide_profile($1::uuid, 'rejected', $2)";
      assert.equal(await rejection(db, decide, [USERS.pending, '!!!']), 'invalid:needs_letters');
    });
  });
});
