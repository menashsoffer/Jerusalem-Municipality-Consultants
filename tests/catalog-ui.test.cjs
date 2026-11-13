const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM} = require('jsdom');

test('approved viewer searches the new catalog without a legacy admin claim', async () => {
  const html = fs.readFileSync('web/index.html', 'utf8');
  const dom = new JSDOM(html, {url:'https://example.test/'});
  const {window} = dom;
  global.document = window.document;
  global.Option = window.Option;
  try {
    const view = await import('../web/src/catalog-view.ts');
    const {start} = await import('../web/src/app/app.ts');
    let opened = null;
    const site = {
      BASE:'https://example.test', canAddSupplier: () => false,
      currentUser: async () => ({ok:true, json:async () => ({id:'viewer',app_metadata:{}})}),
      access: async () => ({state:'active', member:true, admin:false}),
      catalog: async () => [{id:'s1', name:'שם נוכחי', aliases:['שם קודם'], verified:true,
        memberships:[], contacts:[]}],
      track: async () => {}, exchangeCode: async () => ({ok:false}), sendLink: async () => ({ok:true}),
    };
    window.sessionStorage.setItem('consultants-session-v1', JSON.stringify({token:'x',exp:Date.now()+60000}));
    await start({
      win: window, site, view,
      details: {open: async (id, token) => { opened = {id, token}; }, close: () => {}},
      write: {bind: () => {}, open: async () => {}},
    });
    assert.equal(window.document.querySelector('#private-content').hidden, false);
    assert.equal(window.document.querySelector('#results').querySelectorAll('.card').length, 1);
    const input = window.document.querySelector('#query');
    input.value = 'שם קודם';
    input.dispatchEvent(new window.Event('input', {bubbles:true}));
    assert.match(window.document.querySelector('#results').textContent, /שם נוכחי/);
    assert.match(window.document.querySelector('#results').textContent, /ספק מאומת/);
    assert.equal(window.document.querySelector('#add-open').hidden, true);
    window.document.querySelector('.supplier-detail-open').click();
    assert.deepEqual(opened, {id:'s1', token:'x'});
  } finally {
    window.close();
    delete global.document;
    delete global.Option;
  }
});
