const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM} = require('jsdom');
const {performance} = require('node:perf_hooks');

test('renders each supplier once and filters by registry and validity', async () => {
  const html = fs.readFileSync('web/index.html', 'utf8');
  const dom = new JSDOM(html, {url:'https://example.test/'});
  global.document = dom.window.document;
  global.Option = dom.window.Option;
  try {
    const view = await import('../web/src/catalog-view.ts');
    const memberships = [{registryId:'r1', registry:'מאגר א', fieldId:'f1', field:'תכנון',
      unitId:'u1', unit:'אגף א', validFrom:null, validUntil:'2099-01-01', source:null, page:null},
    {registryId:'r2', registry:'מאגר ב', fieldId:'f2', field:'ניהול', unitId:'u2', unit:'אגף ב',
      validFrom:null, validUntil:'2020-01-01', source:null, page:null}];
    const rows = Array.from({length:533}, (_,i) => ({id:`s${i}`, name:`ספק ${i}`, aliases:[],
      verified:i===0, memberships:i===0 ? memberships : [memberships[0]], contacts:[]}));
    view.setSuppliers(rows);
    assert.equal(document.querySelectorAll('#results .card').length, 533);
    assert.match(document.querySelector('#count').textContent, /533/);
    document.querySelector('#registry').value = 'r2';
    view.options();
    document.querySelector('#validity-filter').value = 'expired';
    const start = performance.now();
    view.render();
    assert.equal(document.querySelectorAll('#results .card').length, 1);
    assert.match(document.querySelector('#results').textContent, /ספק 0/);
    assert.ok(performance.now() - start < 1000);
  } finally {
    dom.window.close();
    delete global.document;
    delete global.Option;
  }
});


test('shows only subcategories of the selected root and clears stale selection', async () => {
  const dom = new JSDOM(fs.readFileSync('web/index.html', 'utf8'), {url:'https://example.test/'});
  global.document = dom.window.document;
  global.Option = dom.window.Option;
  try {
    const view = await import('../web/src/catalog-view.ts');
    const common = {registryId:'r1', registry:'מאגר', fieldId:'f1', field:'תחום', unitId:'u', unit:'אגף', validFrom:null, validUntil:null, source:null, page:null};
    view.setSuppliers([{id:'s1',name:'א',aliases:[],verified:false,contacts:[],memberships:[{...common,categoryId:'c1',categoryName:'כבישים',parentCategoryId:'r1',parentCategoryName:'הנדסה'}]},
      {id:'s2',name:'ב',aliases:[],verified:false,contacts:[],memberships:[{...common,categoryId:'c2',categoryName:'מוזיקה',parentCategoryId:'r2',parentCategoryName:'תרבות'}]}]);
    const root = document.querySelector('#category-filter'), child = document.querySelector('#subcategory-filter');
    assert.equal(child.disabled,true);
    root.value='r1';view.options();assert.deepEqual([...child.options].map(option=>option.value),['','c1']);
    child.value='c1';view.render();assert.equal(document.querySelectorAll('#results .card').length,1);
    root.value='r2';view.options();assert.equal(child.value,'');assert.deepEqual([...child.options].map(option=>option.value),['','c2']);
  } finally {dom.window.close();delete global.document;delete global.Option;}
});
