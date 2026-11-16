import assert from 'node:assert/strict';
import { it, mock } from 'node:test';

import * as site from '../src/data/site.ts';
import * as view from '../src/write-view.ts';
import {
  access,
  requestBody,
  requestUrl,
  response,
  SUPPLIER,
  TOKEN,
  wireCatalog,
} from './catalog-fixture.ts';
import { object } from '../src/data/parse.ts';
import { domFixture } from './dom-fixture.ts';

const tick = () =>
  new Promise((resolve) => {
    setImmediate(resolve);
  });

it('requires a duplicate choice, saves it, then revalidates using the current snapshot version', async () => {
  const dom = domFixture();
  const payloads: unknown[] = [];
  const versions: unknown[] = [];
  const catalog = wireCatalog();
  assert.ok(catalog.suppliers[0]);
  catalog.suppliers[0][1] = 'חברת אלון בעמ';
  let version = '1:roles';
  const fetcher: typeof fetch = (input, init) => {
    const path = new URL(requestUrl(input)).pathname.split('/').at(-1);
    if (path === 'catalog_snapshot') {
      versions.push(object(requestBody(init)).known_version);
      return Promise.resolve(
        Response.json(
          response({
            version,
            catalog,
            access: access({
              editor: true,
              grants: [{ role: 'editor', unitId: 'u1' }],
            }),
          }),
        ),
      );
    }
    if (path === 'save_supplier_membership') {
      payloads.push(object(requestBody(init)).payload);
      version = '2:changed';
      return Promise.resolve(Response.json(SUPPLIER));
    }
    assert.equal(path, 'supplier_identifiers');
    return Promise.resolve(Response.json([]));
  };
  const spy = mock.method(globalThis, 'fetch', fetcher);
  try {
    await site.clearCatalog();
    await site.loadSnapshot(TOKEN);
    assert.equal(site.canAddSupplier(), true);
    view.bind(async () => {
      await site.catalog(TOKEN);
    });
    await view.open(TOKEN);
    const name = dom.el('#add-name') as HTMLInputElement;
    name.value = 'חברת אלן בעמ';
    name.dispatchEvent(new dom.window.Event('input'));
    assert.equal(dom.el('#duplicate-choices').hidden, false);
    const select = dom.el('#add-version') as HTMLSelectElement;
    select.value = 'v1';
    select.dispatchEvent(new dom.window.Event('change'));
    (dom.el('#add-registry-field') as HTMLSelectElement).value = 'f1';
    const form = dom.el('#supplier-add-form');
    form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await tick();
    assert.match(dom.el('#supplier-add-error').textContent, /יש לבחור ספק/);
    assert.equal(payloads.length, 0);
    (dom.el(`input[name="supplier_choice"][value="${SUPPLIER}"]`) as HTMLInputElement).checked =
      true;
    form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await tick();
    await tick();
    assert.equal(payloads.length, 1);
    assert.equal(object(payloads[0]).supplier_id, SUPPLIER);
    assert.equal(object(payloads[0]).registry_field_id, 'f1');
    assert.deepEqual(versions, [null, '1:roles']);
    assert.match(dom.el('#catalog-feedback').textContent, /נשמר/);
  } finally {
    spy.mock.restore();
    await site.clearCatalog();
    dom.close();
  }
});
