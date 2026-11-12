const test = require('node:test');
const assert = require('node:assert/strict');
const forms = require('../docs/assets/directory-forms.js');

class Select {
  constructor() { this.options = []; this.value = ''; this.listeners = {}; }
  replaceChildren(...options) { this.options = options; this.value = ''; }
  add(option) { this.options.push(option); }
  addEventListener(name, fn) { this.listeners[name] = fn; }
}
const option = (name, id) => ({name, id});

test('selects departments only from the chosen administration', () => {
  const administration = new Select(), department = new Select();
  const units = [{id: 'a', name: 'א', kind: 'administration', parent_id: null},
    {id: 'b', name: 'ב', kind: 'administration', parent_id: null},
    {id: 'a1', name: 'א1', kind: 'department', parent_id: 'a'},
    {id: 'b1', name: 'ב1', kind: 'department', parent_id: 'b'}];
  const model = forms.mountUnitSelectors({units, administration, department, makeOption: option});
  assert.equal(department.disabled, true);
  administration.value = 'a'; administration.listeners.change();
  assert.deepEqual(department.options.map(item => item.id), ['', 'a1']);
  department.value = 'b1';
  assert.equal(model.selectedDepartment(), null);
  department.value = 'a1';
  assert.equal(model.selectedDepartment().id, 'a1');
  administration.value = 'b'; administration.listeners.change();
  assert.equal(department.value, '');
});

test('only root categories can be selected as a parent', () => {
  const select = new Select();
  const model = forms.populateCategoryParents(select, [{id: 'root', name: 'ראשי', parent_id: null},
    {id: 'child', name: 'משני', parent_id: 'root'}], option);
  assert.equal(model.validParent('root'), true);
  assert.equal(model.validParent('child'), false);
  assert.equal(forms.similarCategoryNames([{name: 'תכנון עירוני'}], 'תכנון').length, 1);
});
