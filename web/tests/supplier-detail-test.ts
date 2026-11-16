import assert from 'node:assert/strict';
import { it } from 'node:test';

import { supplierDetail } from '../src/data/supplier-detail.ts';
import { compactCatalog } from '../src/data/compact-catalog.ts';
import { render } from '../src/detail-view.ts';
import { client, requestBody, requestUrl, SUPPLIER, wireCatalog } from './catalog-fixture.ts';
import { domFixture } from './dom-fixture.ts';

const AUDIT = {
  id: 1,
  row_id: 'deleted',
  table_name: 'supplier_contacts',
  operation: 'DELETE',
  changes: { supplier_id: { old: SUPPLIER, new: null } },
  created_at: '2026-11-12T12:00:00Z',
};

it('loads identifiers and permitted audit in one RPC, including deleted related rows', async () => {
  const cached = compactCatalog(wireCatalog());
  for (const audit of [null, [AUDIT]]) {
    let requests = 0;
    const api = client((url, init) => {
      requests++;
      assert.match(requestUrl(url), /rpc\/supplier_detail$/);
      assert.deepEqual(requestBody(init), { supplier_id: SUPPLIER });
      return Response.json({ identifiers: [], audit });
    });
    const detail = await supplierDetail(api, cached, SUPPLIER);
    assert.equal(requests, 1);
    assert.equal(detail.supplier.display_name, 'שם נוכחי');
    assert.deepEqual(detail.audit, audit);
  }
});

it('rejects an invalid or unknown supplier without requesting data, and validates the reply', async () => {
  const cached = compactCatalog(wireCatalog());
  let requests = 0;
  const api = client(() => {
    requests++;
    return Response.json({ identifiers: 'bad', audit: null });
  });
  await assert.rejects(supplierDetail(api, cached, 'invalid'));
  await assert.rejects(supplierDetail(api, cached, '40000000-0000-0000-0000-000000000099'));
  assert.equal(requests, 0);
  await assert.rejects(supplierDetail(api, cached, SUPPLIER));
  assert.equal(requests, 1);
});

it('displays invalid contacts, source links and date provenance, with no audit for a viewer', async () => {
  const dom = domFixture();
  try {
    const data = await supplierDetail(
      client(() => Response.json({ identifiers: [], audit: null })),
      compactCatalog(wireCatalog()),
      SUPPLIER,
    );
    const contact = data.contacts[0];
    const member = data.memberships[0];
    assert.ok(contact);
    assert.ok(member);
    data.contacts = Array.from({ length: 78 }, (_, index) => ({
      ...contact,
      value: `bad ${String(index)}`,
    }));
    data.memberships = [
      { ...member, engagement_started_on: '2024-02-01', dates_source: 'municipal_registry' },
    ];
    render(data);
    const content = dom.el('#supplier-content');
    assert.equal((content.textContent.match(/לא תקין/g) ?? []).length, 78);
    assert.match(content.textContent, /מקור התאריכים: מאגר העירייה/);
    assert.match(content.textContent, /2024-02-01/);
    assert.ok(content.querySelector('a[href="https://example.test/source"]'));
    assert.doesNotMatch(content.textContent, /היסטוריית שינויים/);
  } finally {
    dom.close();
  }
});
