const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM} = require('jsdom');

const tick = () => new Promise(resolve => setImmediate(resolve));

test('requires a duplicate decision and submits the selected supplier to the new model', async () => {
  const dom = new JSDOM(fs.readFileSync('web/index.html','utf8'), {url:'https://example.test/'});
  const saved = {document:global.document, Option:global.Option, FormData:global.FormData, fetch:global.fetch};
  global.document = dom.window.document;
  global.Option = dom.window.Option;
  global.FormData = dom.window.FormData;
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const supplierId = '40000000-0000-0000-0000-000000000001';
  const payloads = [];
  const tables = {
    profiles:[{status:'active'}], role_grants:[{role:'editor',unit_id:'u1',revoked_at:null,expires_at:null}],
    suppliers:[{id:supplierId,display_name:'חברת אלון בעמ',status:'active',review_status:'needs_review'}],
    supplier_names:[], memberships:[], registry_versions:[{id:'v1',registry_id:'r1',valid_from:null,valid_until:null}],
    registries:[{id:'r1',name:'מאגר א',status:'active',owner_unit_id:'u1'}],
    registry_fields:[{id:'f1',registry_id:'r1',source_text:'תכנון'}], org_units:[],
    supplier_contacts:[], source_documents:[], supplier_identifiers:[],
  };
  global.fetch = async (input, init) => {
    const url = new URL(input);
    const path = url.pathname.split('/').at(-1);
    assert.notEqual(path, 'legacy_suppliers');
    if (path === 'my_access') return Response.json({member:true,admin:false,editor:true,manager:false});
    if (path === 'save_supplier_membership') {
      payloads.push(JSON.parse(init.body).payload);
      return Response.json(supplierId);
    }
    return Response.json(tables[path] || []);
  };
  try {
    const site = await import('../web/src/data/site.ts');
    const view = await import('../web/src/write-view.ts');
    await site.access('token','user');
    await site.catalog('token');
    assert.equal(site.canAddSupplier(), true);
    view.bind(async () => {});
    await view.open('token');
    const name = document.querySelector('#add-name');
    name.value = 'חברת אלן בעמ';
    name.dispatchEvent(new dom.window.Event('input', {bubbles:true}));
    assert.equal(document.querySelector('#duplicate-choices').hidden, false);
    const version = document.querySelector('#add-version');
    version.value = 'v1';
    version.dispatchEvent(new dom.window.Event('change', {bubbles:true}));
    document.querySelector('#add-registry-field').value = 'f1';
    const form = document.querySelector('#supplier-add-form');
    form.dispatchEvent(new dom.window.Event('submit', {bubbles:true,cancelable:true}));
    await tick();
    assert.match(document.querySelector('#supplier-add-error').textContent, /יש לבחור ספק/);
    assert.equal(payloads.length, 0);
    document.querySelector(`input[name="supplier_choice"][value="${supplierId}"]`).checked = true;
    form.dispatchEvent(new dom.window.Event('submit', {bubbles:true,cancelable:true}));
    await tick();
    await tick();
    assert.equal(payloads.length, 1);
    assert.equal(payloads[0].supplier_id, supplierId);
    assert.equal(payloads[0].registry_field_id, 'f1');
    assert.match(document.querySelector('#catalog-feedback').textContent, /נשמר/);
  } finally {
    dom.window.close();
    for (const [key,value] of Object.entries(saved)) {
      if (value === undefined) delete global[key]; else global[key] = value;
    }
  }
});
