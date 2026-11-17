// Ported from tests/web-data.test.cjs (task R12).
import assert from 'node:assert/strict';
import { it } from 'node:test';

import { DataClient, DataError } from '../src/data/client.ts';
import { requestBody } from './catalog-fixture.ts';

function api(fetcher: typeof fetch): DataClient {
  return new DataClient({ baseUrl: 'https://db.test', publicKey: 'key', token: 'token', fetcher });
}
const url = (input: Parameters<typeof fetch>[0]) =>
  input instanceof Request ? input.url : input.toString();

it('does not report a successful insert with an empty 201 response as a failure', async () => {
  const client = api((input, init) => {
    assert.match(url(input), /supplier_names$/);
    assert.equal(new Headers(init?.headers).get('prefer'), 'return=minimal');
    return Promise.resolve(new Response(null, { status: 201 }));
  });
  await client.insert('supplier_names', { supplier_id: 'x', name: 'שם' });
});

it('rejects a write without a filter and localizes authorization errors', async () => {
  const client = api(() => Promise.resolve(new Response(null, { status: 403 })));
  await assert.rejects(client.update('suppliers', {}, { display_name: 'שם' }), /requires a filter/);
  await assert.rejects(client.remove('supplier_names', {}), /requires a filter/);
  await assert.rejects(client.list('suppliers'), /אין לך הרשאה/);
});

it('does not report a change that affected no visible rows as successful', async () => {
  const client = api(() => Promise.resolve(Response.json([])));
  await assert.rejects(
    client.update('suppliers', { id: 'eq.nope' }, { display_name: 'שם' }),
    /לא ניתן לאמת/,
  );
});

it('calls browser fetch without the client object as its receiver', async () => {
  const client = api(function (this: unknown) {
    assert.equal(this, undefined);
    return Promise.resolve(Response.json([]));
  });
  assert.deepEqual(await client.list('suppliers'), []);
});

it('explains each error status in Hebrew', () => {
  assert.match(new DataError(401).message, /פג תוקף/);
  assert.match(new DataError(409).message, /כבר קיימת/);
  assert.match(new DataError(500).message, /לא ניתן להשלים/);
  assert.equal(new DataError(500).status, 500);
});

it('reports a network failure and a body that is not JSON as status 0', async () => {
  await assert.rejects(
    api(() => Promise.reject(new Error('offline'))).list('suppliers'),
    (error: unknown) => error instanceof DataError && error.status === 0,
  );
  await assert.rejects(
    api(() => Promise.resolve(new Response('<html>'))).rpc('load_control', {}),
    (error: unknown) => error instanceof DataError && error.status === 0,
  );
  await assert.rejects(api(() => Promise.resolve(Response.json({}))).list('suppliers'), DataError);
});

it('calls the unauthorized handler on 401 and returns nothing for 204', async () => {
  let cleared = 0;
  const expired = new DataClient({
    baseUrl: 'https://db.test/',
    publicKey: 'key',
    token: 'token',
    fetcher: () => Promise.resolve(new Response(null, { status: 401 })),
    onUnauthorized: () => {
      cleared += 1;
      return Promise.resolve();
    },
  });
  await assert.rejects(expired.list('suppliers'), /פג תוקף/);
  assert.equal(cleared, 1);
  const empty = api((input) => {
    assert.equal(url(input), 'https://db.test/rest/v1/rpc/load_control');
    return Promise.resolve(new Response(null, { status: 204 }));
  });
  assert.equal(await empty.rpc('load_control', {}), null);
});

it('reads every page of a long list and orders profiles by user', async () => {
  const offsets: string[] = [];
  const client = api((input) => {
    const query = new URL(url(input)).searchParams;
    offsets.push(query.get('offset') ?? '');
    assert.equal(query.get('order'), 'user_id.asc');
    const size = query.get('offset') === '0' ? 500 : 2;
    return Promise.resolve(Response.json(Array.from({ length: size }, () => ({}))));
  });
  assert.equal((await client.list('profiles')).length, 502);
  assert.deepEqual(offsets, ['0', '500']);
});

it('returns the id of a supplier write and rejects any other answer', async () => {
  const saved = api((_input, init) => {
    assert.deepEqual(requestBody(init), { payload: { a: '1' } });
    return Promise.resolve(Response.json('id-1'));
  });
  assert.equal(await saved.supplierWrite('rename_supplier', { a: '1' }), 'id-1');
  const odd = api(() => Promise.resolve(Response.json({ id: 1 })));
  await assert.rejects(odd.supplierWrite('rename_supplier', {}), DataError);
});

it('confirms an update or a delete only when rows came back', async () => {
  const done = api(() => Promise.resolve(Response.json([{ id: 'x' }])));
  await done.update('suppliers', { id: 'eq.x' }, { display_name: 'שם' });
  await done.remove('supplier_names', { id: 'eq.x' });
  const none = api(() => Promise.resolve(Response.json({})));
  await assert.rejects(none.remove('supplier_names', { id: 'eq.x' }), /לא ניתן לאמת/);
});
