const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const catalog = require('../docs/assets/catalog.js');

class Element {
  constructor() { this.listeners = {}; this.value = ''; this.options = []; this.hidden = false; this.disabled = false; this.children = []; }
  addEventListener(name, handler) { this.listeners[name] = handler; }
  replaceChildren(...items) { this.options = [...items]; this.children = [...items]; }
  add(option) { this.options.push(option); }
  append(...items) { this.children.push(...items); }
  showModal() { this.open = true; }
  close() { this.open = false; }
  reset() {}
  closest() { return null; }
}

test('add supplier requires an existing field in the selected registry', async () => {
  const elements = new Map();
  const get = selector => {
    if (!elements.has(selector)) elements.set(selector, new Element());
    return elements.get(selector);
  };
  const source = [{id: 1, name: 'קיים', registry: 'מאגר א', field: 'תכנון'},
                  {id: 2, name: 'אחר', registry: 'מאגר ב', field: 'חשבות'}];
  let submitted = [];
  let values = {name: 'חדש', registry: 'מאגר א', field: 'חשבות', phone: '', email: ''};
  const fakeFetch = async (url, options = {}) => {
    if (url.includes('/auth/v1/user')) return {ok: true, json: async () => ({id: 'admin', app_metadata: {role: 'supplier_admin'}})};
    if (url.includes('/rest/v1/suppliers') && options.method === 'POST') { submitted.push(JSON.parse(options.body)); return {ok: true}; }
    if (url.includes('/rest/v1/suppliers')) return {ok: true, json: async () => source};
    return {ok: true};
  };
  const storage = new Map([['consultants-session-v1', JSON.stringify({token: 'test', exp: Date.now() + 60000})]]);
  const context = {
    document: {querySelector: get, createElement: () => new Element(), createTextNode: value => value, addEventListener: () => {}},
    Option: function (label, value) { return {label, value}; },
    sessionStorage: {getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key)},
    location: {href: 'https://example.org/', hash: '', pathname: '/', search: '', origin: 'https://example.org'},
    history: {replaceState() {}}, URL, URLSearchParams, Date, fetch: fakeFetch,
    FormData: function () { return {get: key => values[key]}; },
    SupplierCatalog: catalog, setTimeout, clearTimeout,
    DirectoryApi: {createClient: () => ({getAccess: async () => ({active:true,admin:true,manageProfiles:true})})},
    DirectoryForms: {}, DirectoryEnrollment: {mount: async () => {}}, DirectoryCategoryRequests: {mount: async () => {}},
    DirectoryReview: {mountProfiles: async () => {}, mountCategories: async () => {}},
    DirectoryWorkflow: require('../docs/assets/directory-workflow.js'),
  };
  const app = fs.readFileSync(path.join(__dirname, '../docs/assets/app.js'), 'utf8');
  vm.runInNewContext(app, context);
  await new Promise(resolve => setImmediate(resolve));
  get('#add-open').listeners.click();
  get('#add-registry').value = 'מאגר א';
  get('#add-registry').listeners.change();
  assert.deepEqual(get('#add-field').options.map(option => option.value), ['', 'תכנון']);
  const event = {preventDefault() {}, currentTarget: get('#add-form')};
  await get('#add-form').listeners.submit(event);
  assert.equal(submitted.length, 0);
  values = {...values, field: 'תכנון'};
  await get('#add-form').listeners.submit(event);
  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].review_status, 'needs_review');
  assert.equal(submitted[0].registry, 'מאגר א');
});
