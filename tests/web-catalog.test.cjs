const test = require('node:test');
const assert = require('node:assert/strict');

const catalog = import('../web/src/catalog.ts');

function fakeFetch(existing, rows) {
  const calls = [];
  const fetcher = async (url) => {
    calls.push(url);
    const ok = url.includes('/rest/v1/' + existing + '?');
    return {ok, status: ok ? 200 : 404, json: async () => rows};
  };
  return {fetcher, calls};
}

test('typed catalog loads and falls back with the same behavior', async () => {
  const api = await catalog;
  const {fetcher, calls} = fakeFetch('suppliers', [{id: 2}]);
  assert.deepEqual(await api.loadAllSuppliers(fetcher, 'https://db', {}), [{id: 2}]);
  assert.equal(calls.length, 2);
  assert.equal(api.tableName(), 'suppliers');
});

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
