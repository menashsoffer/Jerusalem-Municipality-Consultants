const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Element {
  constructor() { this.listeners = {}; this.value = ''; this.options = []; this.textContent = ''; }
  addEventListener(name, handler) { this.listeners[name] = handler; }
  showModal() { this.open = true; }
}

test('expired OAuth state produces a safe explanation and removes error details from the URL', async () => {
  const elements = new Map();
  const select = key => { if (!elements.has(key)) elements.set(key, new Element()); return elements.get(key); };
  const storage = new Map([['consultants-pkce-v1', 'old-verifier']]);
  let replacement;
  const context = {
    document: {querySelector: select, addEventListener() {}},
    location: {href: 'https://example.org/app/?error=invalid_request&error_code=bad_oauth_state&error_description=private-detail&keep=1',
      hash: '', pathname: '/app/', search: '?error=invalid_request&error_code=bad_oauth_state&error_description=private-detail&keep=1'},
    history: {replaceState: (_state, _title, url) => { replacement = url; }},
    sessionStorage: {getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key)},
    URL, URLSearchParams, Date, setTimeout, clearTimeout,
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../web/assets/app.js'), 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  assert.match(select('#login-message').textContent, /פג/);
  assert.equal(replacement, '/app/?keep=1');
  assert.equal(storage.has('consultants-pkce-v1'), false);
  assert.equal(select('#login-dialog').open, true);
});
