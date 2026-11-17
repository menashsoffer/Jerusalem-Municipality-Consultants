// Ported from tests/web-data.test.cjs (task R12).
import assert from 'node:assert/strict';
import { it } from 'node:test';

import { DataClient } from '../src/data/client.ts';

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
