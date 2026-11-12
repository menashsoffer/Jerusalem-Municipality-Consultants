const test = require('node:test');
const assert = require('node:assert/strict');

const api = import('../web/src/data/client.ts');

test('successful inserts with an empty 201 response are not reported as failures', async () => {
  const {DataClient} = await api;
  const fetcher = async (url, init) => {
    assert.match(url, /supplier_names$/);
    assert.equal(init.headers.get('prefer'), 'return=minimal');
    return new Response(null, {status: 201});
  };
  const client = new DataClient({baseUrl: 'https://db.test', publicKey: 'key', token: 'token', fetcher});
  await client.insert('supplier_names', {supplier_id: 'x', name: 'שם'});
});

test('write without a filter is rejected and authorization errors are localized', async () => {
  const {DataClient} = await api;
  const fetcher = async () => new Response(null, {status: 403});
  const client = new DataClient({baseUrl: 'https://db.test', publicKey: 'key', token: 'token', fetcher});
  await assert.rejects(client.update('suppliers', {}, {display_name: 'שם'}), /requires a filter/);
  await assert.rejects(client.remove('supplier_names', {}), /requires a filter/);
  await assert.rejects(client.list('suppliers'), /אין לך הרשאה/);
});

test('a change affecting no visible rows is not reported as successful', async () => {
  const {DataClient} = await api;
  const fetcher = async () => Response.json([]);
  const client = new DataClient({baseUrl: 'https://db.test', publicKey: 'key', token: 'token', fetcher});
  await assert.rejects(client.update('suppliers', {id: 'eq.nope'}, {display_name: 'שם'}), /לא ניתן לאמת/);
});

test('calls browser fetch without a client object as its receiver', async () => {
  const {DataClient} = await api;
  const fetcher = async function () {
    'use strict';
    assert.equal(this, undefined);
    return Response.json([]);
  };
  const client = new DataClient({baseUrl: 'https://db.test', publicKey: 'key', token: 'token', fetcher});
  assert.deepEqual(await client.list('suppliers'), []);
});
