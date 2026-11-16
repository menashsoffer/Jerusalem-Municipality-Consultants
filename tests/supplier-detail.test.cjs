const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM} = require('jsdom');

const supplierId = '40000000-0000-0000-0000-000000000001';
const deletedId = '50000000-0000-0000-0000-000000000001';
const auditEvent = {id:1, row_id:deletedId, table_name:'supplier_contacts', operation:'DELETE',
  changes:{supplier_id:{old:supplierId,new:null}}, created_at:'2026-11-12T12:00:00Z'};
const cached = {
  suppliers:[{id:supplierId,display_name:'ספק לדוגמה',entity_kind:'company',review_status:'verified'}],
  names:[], contacts:[], memberships:[], versions:[], registries:[], fields:[], documents:[],
};
const access = role => ({state:'active', member:true, admin:role==='admin', editor:false,
  manager:false, grants:role==='auditor' ? [{role:'auditor',unitId:null}] : []});

test('supplier details use one RPC and preserve the server audit policy', async () => {
  const {supplierDetail} = await import('../web/src/data/supplier-detail.ts');
  const calls = [];
  const client = {rpc: async (name, payload) => {
    calls.push({name,payload}); return {identifiers:[], audit:[{...auditEvent,actor_id:null}]};
  }};
  const result = await supplierDetail(client,cached,{supplierId,access:access('admin')});
  assert.equal(result.audit[0].row_id,deletedId);
  assert.deepEqual(calls,[{name:'supplier_detail',payload:{supplier_id:supplierId}}]);
  const viewer = await supplierDetail({rpc: async () => ({identifiers:[],audit:null})},
    cached,{supplierId,access:access('viewer')});
  assert.equal(viewer.audit,null);
});

test('invalid detail responses and RPC errors are reported', async () => {
  const {supplierDetail} = await import('../web/src/data/supplier-detail.ts');
  await assert.rejects(supplierDetail({rpc: async () => ({identifiers:'wrong'})},
    cached,{supplierId,access:access('admin')}));
});

test('displays invalid contacts, their source and the recorded date provenance', async () => {
  const dom = new JSDOM(fs.readFileSync('web/index.html','utf8'), {url:'https://example.test/'});
  global.document = dom.window.document;
  try {
    const {render} = await import('../web/src/detail-view.ts');
    const contacts = Array.from({length:78}, (_,i) => ({kind:'email',value:`invalid ${i}`,
      is_valid:false,source_document_id:'d1'}));
    render({supplier:{display_name:'ספק לדוגמה',entity_kind:'company',review_status:'verified'},
      names:[{name:'שם נוסף',source_document_id:'d1'}], identifiers:[], contacts,
      memberships:[{registry_version_id:'v1',registry_field_id:'f1',registered_from:'2024-01-01',
        registered_until:'2027-01-01',engagement_started_on:'2024-02-01',dates_source:'municipal_registry',
        review_status:'verified',source_page:2}],
      versions:[{id:'v1',registry_id:'r1',source_document_id:'d1'}],
      registries:[{id:'r1',name:'מאגר א'}], fields:[{id:'f1',source_text:'תכנון'}],
      documents:[{id:'d1',url:'https://example.test/source'}], audit:null});
    const content = document.querySelector('#supplier-content');
    assert.equal((content.textContent.match(/לא תקין/g) || []).length, 78);
    assert.match(content.textContent, /מקור התאריכים: מאגר העירייה/);
    assert.match(content.textContent, /2024-02-01/);
    assert.ok(content.querySelector('a[href="https://example.test/source"]'));
    assert.doesNotMatch(content.textContent, /היסטוריית שינויים/);
  } finally {
    dom.window.close();
    delete global.document;
  }
});
