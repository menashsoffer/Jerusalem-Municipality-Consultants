const test = require('node:test');
const assert = require('node:assert/strict');
const catalog = require('../docs/assets/catalog.js');

function fakeFetch(existing, rows) {
  const calls = [];
  const fetcher = async (url) => {
    calls.push(url);
    const ok = url.includes('/rest/v1/' + existing + '?');
    return {ok, status: ok ? 200 : 404, json: async () => rows};
  };
  return {fetcher, calls};
}

test('reads legacy_suppliers once the migrations are applied', async () => {
  const {fetcher, calls} = fakeFetch('legacy_suppliers', [{id: 1}]);
  assert.deepEqual(await catalog.loadAllSuppliers(fetcher, 'https://db', {}), [{id: 1}]);
  assert.equal(calls.length, 1);
  assert.equal(catalog.tableName(), 'legacy_suppliers');
});

test('falls back to suppliers before the migrations are applied', async () => {
  const {fetcher} = fakeFetch('suppliers', [{id: 2}]);
  assert.deepEqual(await catalog.loadAllSuppliers(fetcher, 'https://db', {}), [{id: 2}]);
  assert.equal(catalog.tableName(), 'suppliers');
});
