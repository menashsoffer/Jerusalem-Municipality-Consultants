const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM} = require('jsdom');

const html = fs.readFileSync('web/index.html', 'utf8');
const script = fs.readFileSync('web/public/assets/app.js', 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));

async function page(access, metadata, supplies) {
  const dom = new JSDOM(html, {url: 'https://example.test/app/', runScripts: 'outside-only'});
  const {window} = dom;
  const catalog = await import('../web/src/catalog.ts');
  window.SupplierCatalog = catalog;
  let calls = 0;
  window.SiteData = {
    BASE: 'https://example.test',
    currentUser: async () => ({ok: true, json: async () => ({id: 'user', app_metadata: metadata})}),
    access: async () => access,
    legacySuppliers: async () => { calls++; return supplies(); },
    track: async () => {},
  };
  window.sessionStorage.setItem('consultants-session-v1', JSON.stringify({token:'token',exp:Date.now()+60000}));
  window.eval(script);
  for (let i=0; i<3; i++) await tick();
  return {window, calls: () => calls, close: () => window.close()};
}

test('pending user sees waiting screen without requesting supplier data', async () => {
  const p = await page({state:'pending',member:false}, {}, () => []);
  assert.equal(p.window.document.querySelector('#access-status').hidden, false);
  assert.match(p.window.document.querySelector('#access-title').textContent, /ממתינה לאישור/);
  assert.equal(p.window.document.querySelector('#private-content').hidden, true);
  assert.equal(p.window.document.querySelector('#add-open').hidden, true);
  assert.equal(p.calls(), 0);
  p.close();
});

test('viewer cannot see add action when the old catalog is readable', async () => {
  const p = await page({state:'active',member:true,admin:false}, {role:'supplier_admin'}, () => []);
  assert.equal(p.window.document.querySelector('#private-content').hidden, false);
  assert.equal(p.window.document.querySelector('#add-open').hidden, true);
  p.close();
});

test('administrator with legacy permission can see add action', async () => {
  const p = await page({state:'active',member:true,admin:true}, {role:'supplier_admin'}, () => []);
  assert.equal(p.window.document.querySelector('#private-content').hidden, false);
  assert.equal(p.window.document.querySelector('#add-open').hidden, false);
  p.close();
});

test('legacy catalog denial leaves data hidden and shows a recoverable explanation', async () => {
  const p = await page({state:'active',member:true,admin:false}, {role:'supplier_admin'}, () => { throw Error('denied'); });
  assert.equal(p.window.document.querySelector('#private-content').hidden, true);
  assert.match(p.window.document.querySelector('#access-title').textContent, /אינו זמין/);
  assert.equal(p.window.document.querySelector('#add-open').hidden, true);
  p.close();
});


test('newly approved viewer without legacy permission sees transition notice', async () => {
  const p = await page({state:'active',member:true,admin:false}, {}, () => []);
  assert.equal(p.window.document.querySelector('#private-content').hidden, true);
  assert.match(p.window.document.querySelector('#access-title').textContent, /אינו זמין/);
  assert.equal(p.calls(), 0);
  p.close();
});
