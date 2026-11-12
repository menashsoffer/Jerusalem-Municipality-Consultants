const test = require('node:test');
const assert = require('node:assert/strict');

const catalog = import('../web/src/catalog.ts');

test('typed catalog filters source registries, fields and duplicate names', async () => {
  const api = await catalog;
  const rows = [
    {name: 'חברה א', registry: 'ייעוץ', field: 'תכנון'},
    {name: 'חברה א', registry: 'ייעוץ', field: 'ניהול'},
    {name: 'חברה ב', registry: 'אחר', field: 'ניהול'},
  ];
  assert.equal(api.registryNames(rows).length, 2);
  assert.equal(api.fieldsForRegistry(rows, 'ייעוץ').length, 2);
  assert.equal(api.selectionExists(rows, 'ייעוץ', 'תכנון'), true);
  assert.equal(api.selectionExists(rows, 'אחר', 'תכנון'), false);
  assert.equal(api.possibleDuplicates(rows, 'חברה א').length, 2);
});
