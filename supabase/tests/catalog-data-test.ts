import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import type { PGlite } from '@electric-sql/pglite';

import { buildCatalog } from '../../web/src/catalog-model.ts';
import { loadCatalog } from '../../web/src/data/catalog.ts';
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
  'org_units',
  'supplier_contacts',
  'source_documents',
]);
function clientFor(db: PGlite): DataClient {
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const table = url.pathname.split('/').at(-1) ?? '';
    if (!ALLOWED.has(table)) return new Response(null, { status: 404 });
    const where = table === 'suppliers' ? "where status <> 'merged'" : '';
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
});
