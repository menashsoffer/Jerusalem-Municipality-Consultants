// The site data module and the admin RPC helpers, against a stubbed fetch.
import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import { DataError } from '../src/data/client.ts';
import * as rpc from '../src/data/rpc.ts';
import * as site from '../src/data/site.ts';
import { access, requestBody, requestUrl, response, SUPPLIER, TOKEN } from './catalog-fixture.ts';

type Reply = (url: string, init?: RequestInit) => Response;

function stubFetch(reply: Reply) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetcher: typeof fetch = (input, init) => {
    const url = requestUrl(input);
    calls.push({ url, init });
    return Promise.resolve(reply(url, init));
  };
  mock.method(globalThis, 'fetch', fetcher);
  return calls;
}

function snapshotOr(reply: Reply, overrides: Record<string, unknown> = {}): Reply {
  return (url, init) =>
    url.endsWith('/catalog_snapshot') ? Response.json(response(overrides)) : reply(url, init);
}

function signIn(): void {
  rpc.setAdminSession({ token: TOKEN, exp: Date.now() + 60_000 });
}

afterEach(async () => {
  mock.restoreAll();
  rpc.setAdminSession(null);
  await site.clearCatalog();
});

describe('sign-in requests', () => {
  it('exchanges a PKCE code and asks for a magic link with the public key', async () => {
    const calls = stubFetch(() => new Response(null, { status: 200 }));
    await site.exchangeCode('code', 'verifier');
    await site.sendLink('a@x.test', 'https://site.test/a b');
    assert.match(calls[0]?.url ?? '', /\/auth\/v1\/token\?grant_type=pkce$/);
    assert.deepEqual(requestBody(calls[0]?.init), { auth_code: 'code', code_verifier: 'verifier' });
    assert.match(
      calls[1]?.url ?? '',
      /\/auth\/v1\/otp\?redirect_to=https%3A%2F%2Fsite\.test%2Fa%20b$/,
    );
    assert.deepEqual(requestBody(calls[1]?.init), { email: 'a@x.test', create_user: false });
  });
});

describe('request builders', () => {
  it('builds the activity and telemetry requests with the token', () => {
    const events = site.eventRequest('tok', []);
    assert.match(events.url, /\/rest\/v1\/activity_events$/);
    assert.equal((events.init.headers as Record<string, string>).Authorization, 'Bearer tok');
    assert.equal((events.init.headers as Record<string, string>).Prefer, 'return=minimal');
    const telemetry = site.telemetryRequest('tok', []);
    assert.match(telemetry.url, /\/rpc\/record_web_telemetry$/);
    assert.deepEqual(requestBody(telemetry.init), { events: [] });
  });
});

describe('supplier writes', () => {
  it('sends each change to its database function', async () => {
    const calls = stubFetch(() => Response.json('id'));
    assert.equal(await site.saveMembership(TOKEN, { a: '1' }), 'id');
    assert.equal(await site.renameSupplier(TOKEN, { a: '2' }), 'id');
    assert.equal(await site.replaceContact(TOKEN, { a: '3' }), 'id');
    assert.deepEqual(
      calls.map(({ url }) => url.split('/rpc/')[1]),
      ['save_supplier_membership', 'rename_supplier', 'replace_supplier_contact'],
    );
  });
});

describe('catalog state', () => {
  it('cannot add a supplier before the catalog loads or without a writable pool', async () => {
    assert.equal(site.canAddSupplier(), false);
    stubFetch(snapshotOr(() => Response.json([])));
    assert.equal((await site.catalog(TOKEN)).length, 1);
    assert.equal(site.canAddSupplier(), false);
  });

  it('lets an editor add a supplier and loads the write context', async () => {
    const editor = access({ editor: true, grants: [{ role: 'editor', unitId: 'u1' }] });
    const calls = stubFetch(snapshotOr(() => Response.json([]), { access: editor }));
    await site.loadSnapshot(TOKEN);
    assert.equal(site.canAddSupplier(), true);
    const context = await site.writeContext(TOKEN);
    assert.deepEqual(context.identifiers, []);
    assert.ok(calls.some(({ url }) => url.includes('/supplier_identifiers?')));
  });

  it('refuses a card for a token that is no longer the current one', async () => {
    stubFetch(snapshotOr(() => Response.json([])));
    await site.loadSnapshot(TOKEN);
    await assert.rejects(site.detail('other-token', SUPPLIER), /יש להתחבר מחדש/);
  });
});

describe('admin RPC helpers', () => {
  it('requires a live session for every call', async () => {
    assert.throws(() => rpc.sessionToken(), DataError);
    rpc.setAdminSession({ token: TOKEN, exp: Date.now() - 1 }, 'expired');
    assert.equal(rpc.getBootMessage(), 'expired');
    assert.throws(() => rpc.sessionToken(), /פג תוקף/);
    await assert.rejects(rpc.identity(), DataError);
  });

  it('reads identity from the snapshot and checks roles', async () => {
    signIn();
    stubFetch(snapshotOr(() => Response.json([])));
    const who = await rpc.identity();
    assert.equal(who.access.member, true);
    assert.equal(rpc.getAdminSession()?.token, TOKEN);
    await assert.rejects(rpc.requireRoles(['admin']), (e: unknown) => {
      return e instanceof DataError && e.status === 403;
    });
    assert.equal((await rpc.requireRoles(['viewer'])).userId, who.userId);
  });

  it('lets an admin through any role check, but never an inactive user', () => {
    assert.equal(rpc.permitted(access({ admin: true, grants: [] }), ['editor']), true);
    assert.equal(rpc.permitted(access({ state: 'blocked', admin: true }), ['viewer']), false);
  });

  it('validates RPC and table answers with the given schema', async () => {
    signIn();
    stubFetch((url) => (url.includes('/rpc/') ? Response.json(3) : Response.json([{ id: 'a' }])));
    assert.equal(await rpc.rpc('load_control', {}, rpc.z.number()), 3);
    const rows = await rpc.rows('org_units', {}, rpc.z.array(rpc.z.object({ id: rpc.z.string() })));
    assert.deepEqual(rows, [{ id: 'a' }]);
    await assert.rejects(rpc.rpc('load_control', {}, rpc.z.string()));
  });

  it('forgets the session and the catalog when the server says it expired', async () => {
    signIn();
    stubFetch(snapshotOr(() => new Response(null, { status: 401 })));
    await site.loadSnapshot(TOKEN);
    await assert.rejects(rpc.rpc('load_control', {}, rpc.z.unknown()), /פג תוקף/);
    assert.equal(site.getAccess(), null);
    assert.throws(() => rpc.sessionToken(), DataError);
  });

  it('rejects a snapshot whose access does not match the schema', async () => {
    signIn();
    stubFetch(snapshotOr(() => Response.json([]), { access: { state: 'odd' } }));
    await assert.rejects(rpc.identity());
  });
});
