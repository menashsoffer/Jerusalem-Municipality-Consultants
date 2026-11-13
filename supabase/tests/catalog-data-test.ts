import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import type { PGlite } from '@electric-sql/pglite';

import { buildCatalog } from '../../web/src/catalog-model.ts';
import { loadCatalog } from '../../web/src/data/catalog.ts';
import { supplierDetail } from '../../web/src/data/supplier-detail.ts';
import { DataClient } from '../../web/src/data/client.ts';
import { ACCESS_FIXTURE, SUPPLIER, USERS, VERSION } from './access-fixture.ts';
import { as, migratedDatabase } from './pglite.ts';

const ALLOWED = new Set([
  'suppliers',
  'supplier_names',
  'memberships',
  'registry_versions',
  'registries',
  'registry_fields',
  'categories',
  'org_units',
  'supplier_contacts',
  'supplier_identifiers',
  'source_documents',
]);
function clientFor(db: PGlite): DataClient {
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const table = url.pathname.split('/').at(-1) ?? '';
    if (!ALLOWED.has(table)) return new Response(null, { status: 404 });
    const where =
      table === 'suppliers'
        ? "where status <> 'merged'"
        : table === 'supplier_contacts' && url.searchParams.get('status') === 'eq.current'
          ? "where status = 'current'"
          : '';
    const result = await db.query(
      `select * from public.${table} ${where} order by id
      limit $1::int offset $2::int`,
      [Number(url.searchParams.get('limit')), Number(url.searchParams.get('offset'))],
    );
    return Response.json(result.rows);
  };
  return new DataClient({
    baseUrl: 'https://test.invalid',
    publicKey: 'test',
    token: 'test',
    fetcher,
  });
}

describe('new catalog respects database visibility', () => {
  let db: PGlite;
  before(async () => {
    db = await migratedDatabase();
    await db.exec(ACCESS_FIXTURE);
    await db.exec(`insert into public.memberships (supplier_id, registry_version_id, review_status)
      values ('${SUPPLIER}', '${VERSION}', 'needs_review')`);
  });
  after(async () => {
    await db.close();
  });

  it('shows the membership to its editor but not to a viewer until verified', async () => {
    for (const [user, expected] of [
      [USERS.editor, 1],
      [USERS.viewer, 0],
    ] as const) {
      await as(db, user, async () => {
        const rows = buildCatalog(await loadCatalog(clientFor(db)));
        assert.equal(rows.length, 1);
        assert.equal(rows[0]?.memberships.length, expected);
      });
    }
  });

  it('shows only current contact details in the catalog and supplier details', async () => {
    await db.exec(`insert into public.supplier_contacts (supplier_id, kind, value, status) values
      ('${SUPPLIER}', 'phone', '0501111111', 'outdated'),
      ('${SUPPLIER}', 'phone', '0502222222', 'current'),
      ('${SUPPLIER}', 'email', 'disputed@example.test', 'disputed')`);
    await as(db, USERS.editor, async () => {
      const client = clientFor(db);
      const cached = await loadCatalog(client);
      assert.deepEqual(
        buildCatalog(cached)[0]?.contacts.map((contact) => contact.value),
        ['0502222222'],
      );
      const detail = await supplierDetail(client, cached, {
        supplierId: SUPPLIER,
        access: {
          state: 'active',
          member: true,
          admin: false,
          editor: true,
          manager: false,
          grants: [],
        },
      });
      assert.deepEqual(
        detail.contacts.map((contact) => contact.value),
        ['0502222222'],
      );
    });
  });
});
