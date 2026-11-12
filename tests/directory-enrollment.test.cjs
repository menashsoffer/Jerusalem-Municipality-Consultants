const test = require('node:test');
const assert = require('node:assert/strict');
const enrollment = require('../docs/assets/directory-enrollment.js');
const forms = require('../docs/assets/directory-forms.js');
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.attributes = {}; this.listeners = {}; this.value = ''; this.disabled = false; }
  setAttribute(key, value) { this.attributes[key] = value; if (key === 'value') this.value = value; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; if (this.tag === 'select') this.value = ''; }
  add(item) { this.children.push(item); }
  addEventListener(name, fn) { this.listeners[name] = fn; }
  reportValidity() { return true; }
}
const doc = {createElement: tag => new Element(tag)};
function find(node, predicate) { if (predicate(node)) return node; for (const child of node.children) { const result = find(child, predicate); if (result) return result; } }
const units = [{id:'a', name:'מינהל', kind:'administration', parent_id:null}, {id:'d', name:'אגף', kind:'department', parent_id:'a'}];

test('an existing pending profile cannot submit a second application', async () => {
  const container = new Element('div'); let calls = 0;
  await enrollment.mount({container, user:{id:'u'}, forms, document:doc, api:{getProfile:async()=>({status:'pending'}), listUnits:async()=>units, submitProfile:()=>calls++}});
  assert.match(container.children[0].textContent, /ממתינה/);
  assert.equal(find(container, node => node.tag === 'form'), undefined);
  assert.equal(calls, 0);
});

test('enrollment submits only a department belonging to the selected administration', async () => {
  const container = new Element('div'); let payload;
  await enrollment.mount({container, user:{id:'u'}, forms, document:doc, api:{getProfile:async()=>null, listUnits:async()=>units, submitProfile:async input=>{payload=input}}});
  const get = name => find(container, n => n.attributes.name === name);
  const form = find(container, n => n.tag === 'form');
  get('administration').value = 'a'; get('administration').listeners.change();
  get('department').value = 'wrong';
  await form.listeners.submit({preventDefault(){}});
  assert.equal(payload, undefined);
  get('department').value = 'd'; get('firstName').value = 'יעל'; get('lastName').value = 'כהן';
  get('jobTitle').value = 'מנהלת'; get('purpose').value = 'איתור יועצים';
  await form.listeners.submit({preventDefault(){}});
  assert.equal(payload.unitId, 'd'); assert.equal(payload.userId, 'u');
  assert.equal('status' in payload, false);
  assert.match(container.children[0].textContent, /ממתינה/);
});

test('does not accept applications without verified organizational units', async () => {
  const container = new Element('div');
  await enrollment.mount({container, user:{id:'u'}, forms, document:doc, api:{getProfile:async()=>null, listUnits:async()=>[]}});
  assert.equal(find(container, n => n.tag === 'button').disabled, true);
  assert.match(find(container, n => n.attributes.role === 'status').textContent, /יחידות מאומתות/);
});
