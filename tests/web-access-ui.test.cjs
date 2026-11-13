const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM} = require('jsdom');

const html = fs.readFileSync('web/index.html', 'utf8');
const app = import('../web/src/app/app.ts');

function fakeSite(access, supplies, events) {
  let calls = 0;
  const site = {
    BASE: 'https://example.test',
    canAddSupplier: () => !!access.admin,
    currentUser: async () => ({ok: true, json: async () => ({id: 'user'})}),
    access: async () => access,
    catalog: async () => { calls++; return supplies(); },
    track: async (_token, event) => { events.push(event); },
    exchangeCode: async () => ({ok: false}),
    sendLink: async () => ({ok: true}),
  };
  return {site, calls: () => calls};
}

async function page(access, supplies, options = {}) {
  const dom = new JSDOM(html, {url: options.url ?? 'https://example.test/app/'});
  const {window} = dom;
  let dialogOpened = false;
  window.HTMLDialogElement.prototype.showModal = function () { dialogOpened = true; };
  window.HTMLDialogElement.prototype.close = function () {};
  if (options.session !== false) {
    window.sessionStorage.setItem('consultants-session-v1',
      JSON.stringify({token: 'token', exp: Date.now() + 60000}));
  }
  const events = [];
  const {site, calls} = fakeSite(access, supplies, events);
  const view = {setSuppliers: () => {}, options: () => {}, render: () => {}, setOpenHandler: () => {}};
  await (await app).start({
    win: window, site, view,
    details: {open: async () => {}, close: () => {}},
    write: {bind: () => {}, open: async () => {}},
  });
  const $ = (s) => window.document.querySelector(s);
  return {window, $, calls, events, dialogOpened: () => dialogOpened, close: () => window.close()};
}

test('pending user sees waiting screen without requesting supplier data', async () => {
  const p = await page({state:'pending',member:false}, () => []);
  assert.equal(p.$('#access-status').hidden, false);
  assert.match(p.$('#access-title').textContent, /ממתינה לאישור/);
  assert.equal(p.$('#private-content').hidden, true);
  assert.equal(p.$('#add-open').hidden, true);
  assert.equal(p.calls(), 0);
  p.close();
});

test('active account without membership is told it has no access', async () => {
  const p = await page({state:'active',member:false}, () => []);
  assert.match(p.$('#access-title').textContent, /אין הרשאה פעילה/);
  assert.equal(p.calls(), 0);
  p.close();
});

test('viewer cannot see add action while the catalog is readable', async () => {
  const p = await page({state:'active',member:true,admin:false}, () => []);
  assert.equal(p.$('#private-content').hidden, false);
  assert.equal(p.$('#add-open').hidden, true);
  assert.equal(p.calls(), 1);
  assert.deepEqual(p.events.map((e) => e.event_type), ['page_view']);
  p.close();
});

test('administrator can access the new supplier form', async () => {
  const p = await page({state:'active',member:true,admin:true}, () => []);
  assert.equal(p.$('#private-content').hidden, false);
  assert.equal(p.$('#add-open').hidden, false);
  p.close();
});

test('catalog load failure leaves data hidden and shows a recoverable explanation', async () => {
  const p = await page({state:'active',member:true,admin:false}, () => { throw Error('denied'); });
  assert.equal(p.$('#private-content').hidden, true);
  assert.match(p.$('#access-title').textContent, /אינו זמין/);
  assert.equal(p.$('#add-open').hidden, true);
  p.close();
});

test('without a session the login dialog opens and nothing is loaded', async () => {
  const p = await page({state:'active',member:true}, () => [], {session: false});
  assert.equal(p.dialogOpened(), true);
  assert.equal(p.calls(), 0);
  assert.equal(p.$('#private-content').hidden, true);
  p.close();
});

test('an expired sign-in link is explained and removed from the address', async () => {
  const p = await page({state:'active',member:true}, () => [], {
    session: false, url: 'https://example.test/app/#error=access_denied&error_code=otp_expired',
  });
  assert.match(p.$('#login-message').textContent, /תוקף ניסיון ההתחברות פג/);
  assert.equal(p.window.location.hash, '');
  p.close();
});

test('a failed code exchange keeps the user signed out', async () => {
  const p = await page({state:'active',member:true}, () => [], {
    session: false, url: 'https://example.test/app/?code=abc',
  });
  assert.match(p.$('#login-message').textContent, /לא הושלמה/);
  assert.equal(p.window.location.search, '');
  assert.equal(p.calls(), 0);
  p.close();
});
