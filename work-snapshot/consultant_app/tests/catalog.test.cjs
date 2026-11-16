const test = require('node:test');
const assert = require('node:assert/strict');
const catalog = require('../web/assets/catalog.js');

const rows = [
  {registry: 'מאגר א', field: 'תכנון'},
  {registry: 'מאגר א', field: ' תכנון '},
  {registry: 'מאגר א', field: 'רישוי'},
  {registry: 'מאגר ב', field: 'חשבונאות'},
  {registry: null, field: null}
];

test('source choices deduplicate and remain scoped to the selected registry', () => {
  assert.deepEqual(catalog.registryNames(rows), ['מאגר א', 'מאגר ב']);
  assert.deepEqual(new Set(catalog.fieldsForRegistry(rows, 'מאגר א')), new Set(['תכנון', 'רישוי']));
  assert.equal(catalog.selectionExists(rows, 'מאגר א', 'חשבונאות'), false);
  assert.equal(catalog.selectionExists(rows, 'מאגר ב', 'חשבונאות'), true);
  assert.equal(catalog.selectionExists(rows, '', ''), false);
});

test('loads multiple result pages and propagates database failures', async () => {
  const offsets = [];
  const fetcher = async url => {
    const offset = Number(new URL(url).searchParams.get('offset'));
    offsets.push(offset);
    return {ok: true, json: async () => offset === 0 ? Array.from({length: 500}, (_, i) => ({id: i})) : [{id: 500}]};
  };
  assert.equal((await catalog.loadAllSuppliers(fetcher, 'https://example.org', {})).length, 501);
  assert.deepEqual(offsets, [0, 500]);
  await assert.rejects(catalog.loadAllSuppliers(async () => ({ok: false}), 'https://example.org', {}));
});

test('duplicate suggestions are conservative and never combine the records', () => {
  const records = [{name: 'חברת דוגמה', registry: 'א'}, {name: 'חברת-דוגמה', registry: 'ב'}, {name: 'חברה אחרת'}];
  assert.equal(catalog.possibleDuplicates(records, 'חברת דוגמה').length, 2);
  assert.equal(catalog.possibleDuplicates(records, '').length, 0);
  assert.equal(records.length, 3);
});
