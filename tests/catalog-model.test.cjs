const test = require('node:test');
const assert = require('node:assert/strict');
const {performance} = require('node:perf_hooks');
const model = import('../web/src/catalog-model.ts');
const filtering = import('../web/src/catalog-filter.ts');

function fixture() {
  const suppliers = Array.from({length:533}, (_, i) => ({id: `s${i}`, display_name: `ספק ${i}`,
    status:'active', review_status:i === 0 ? 'verified' : 'needs_review'}));
  const extra = Array.from({length: 773}, (_, i) => ({supplier_id:`s${2 + i % 531}`, registry_version_id:'v1', registry_field_id:'f1', name_as_published:null, registered_from:null, registered_until:'2028-01-01', source_page:null, review_status:'verified'}));
  return {
    suppliers,
    names: [{supplier_id:'s0', name:'שם קודם'}],
    memberships: [
      {supplier_id:'s0', registry_version_id:'v1', registry_field_id:'f1', name_as_published:'כתיב נוסף', registered_from:'2020-01-01', registered_until:'2028-01-01', source_page:2},
      {supplier_id:'s0', registry_version_id:'v2', registry_field_id:'f2', name_as_published:null, registered_from:null, registered_until:'2020-01-01', source_page:null},
      {supplier_id:'s1', registry_version_id:'v2', registry_field_id:'f2', name_as_published:null, registered_from:null, registered_until:null, source_page:null},
      ...extra,
    ],
    versions: [{id:'v1', registry_id:'r1', source_document_id:'d1'}, {id:'v2', registry_id:'r2', source_document_id:null}],
    registries: [{id:'r1', name:'מאגר א', owner_unit_id:'u1'}, {id:'r2', name:'מאגר ב', owner_unit_id:'u2'}],
    fields: [{id:'f1', source_text:'תכנון', category_id:'child'}, {id:'f2', source_text:'ניהול', category_id:'other'}],
    categories: [{id:'root',name:'הנדסה',parent_id:null}, {id:'child',name:'כבישים',parent_id:'root'}, {id:'other',name:'ניהול',parent_id:null}],
    units: [{id:'u1', name:'אגף א'}, {id:'u2', name:'אגף ב'}],
    contacts: [{supplier_id:'s0', kind:'email', value:'bad', is_valid:false}],
    documents: [{id:'d1', url:'https://example.test/source'}],
  };
}
const filters = (overrides = {}) => ({query:'',registry:'',field:'',unit:'',validity:'',today:'2026-11-12',...overrides});

test('builds one supplier per entity, retaining aliases, memberships and invalid contacts', async () => {
  const {buildCatalog} = await model;
  const rows = buildCatalog(fixture());
  assert.equal(rows.length, 533);
  const first = rows.find(row => row.id === 's0');
  assert.equal(first.memberships.length, 2);
  assert.equal(first.verified, true);
  assert.equal(first.contacts[0].valid, false);
  assert.equal(first.memberships[0].source, 'https://example.test/source');
});

test('omits suppliers when their memberships are inaccessible or unresolved', async () => {
  const {buildCatalog} = await model;
  const data = fixture();
  data.suppliers.push({id:'hidden', display_name:'hidden', status:'active', review_status:'needs_review'});
  data.suppliers.push({id:'broken', display_name:'broken', status:'active', review_status:'needs_review'});
  data.memberships.push({supplier_id:'broken', registry_version_id:'missing', registry_field_id:null, review_status:'needs_review'});
  const rows = buildCatalog(data);
  assert.equal(rows.some(row => row.id === 'hidden' || row.id === 'broken'), false);
  assert.equal(rows.length, 533);
});

test('searches alternate names and matches combined filters on the same membership', async () => {
  const {buildCatalog} = await model;
  const {filterCatalog} = await filtering;
  const rows = buildCatalog(fixture());
  assert.equal(filterCatalog(rows, filters({query:'שם קודם'}))[0].id, 's0');
  assert.equal(filterCatalog(rows, filters({query:'כתיב נוסף'}))[0].id, 's0');
  assert.equal(filterCatalog(rows, filters({registry:'r1',field:'f1',unit:'u1',validity:'valid'}))[0].id, 's0');
  assert.equal(filterCatalog(rows, filters({registry:'r1',field:'f2'})).length, 0);
  assert.equal(filterCatalog(rows, filters({validity:'expired'}))[0].id, 's0');
  assert.equal(filterCatalog(rows, filters({validity:'undated'}))[0].id, 's1');
});

test('filters the current catalog size in under one second', async () => {
  const {buildCatalog} = await model;
  const {filterCatalog} = await filtering;
  const rows = buildCatalog(fixture());
  const start = performance.now();
  const results = filterCatalog(rows, filters({query:'ספק 5'}));
  assert.ok(results.length > 0);
  assert.ok(performance.now() - start < 1000);
});

test('category and subcategory filters follow the same membership as other filters', async () => {
  const {buildCatalog} = await model;
  const {filterCatalog} = await filtering;
  const rows = buildCatalog(fixture());
  assert.equal(filterCatalog(rows, filters({category:'root',subcategory:'child',registry:'r1'}))[0].id, 's0');
  assert.equal(filterCatalog(rows, filters({category:'root',registry:'r2'})).length, 0);
  assert.equal(filterCatalog(rows, filters({category:'other',registry:'r2'})).length, 2);
  assert.equal(filterCatalog(rows, filters({subcategory:'other',registry:'r1'})).length, 0);
});
