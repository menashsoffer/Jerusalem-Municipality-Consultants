import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CatalogStore } from '../src/data/catalog-store.ts';
import { catalogCache, type CacheEntry } from '../src/data/catalog-cache.ts';
import { snapshotSchema, expandCatalog, type WireCatalog } from '../src/data/snapshot-schema.ts';
import { DataClient, DataError } from '../src/data/client.ts';

const USER = '10000000-0000-0000-0000-000000000001';
const SUPPLIER = '20000000-0000-0000-0000-000000000001';
const VERSION = '30000000-0000-0000-0000-000000000001';
const FIELD = '40000000-0000-0000-0000-000000000001';
const REGISTRY = '50000000-0000-0000-0000-000000000001';
const MEMBER = '60000000-0000-0000-0000-000000000001';
const CATALOG: WireCatalog = {
  suppliers: [
    [
      SUPPLIER,
      'ספק',
      'company',
      'active',
      null,
      'verified',
      null,
      [],
      [[MEMBER, VERSION, FIELD, null, 1, null, null, null, 'unknown', 'verified']],
      [],
    ],
  ],
  registries: [[REGISTRY, 'מאגר', null, 'active']],
  versions: [[VERSION, REGISTRY, null, null, null]],
  fields: [[FIELD, REGISTRY, 'תחום']],
  categories: [],
  fieldCategories: [],
  units: [],
  documents: [],
};
const ACCESS = {
  state: 'active',
  member: true,
  admin: false,
  editor: false,
  manager: false,
  grants: [],
} as const;
const full = (version = '1') => ({ user_id: USER, version, access: ACCESS, catalog: CATALOG });
const saved = (): CacheEntry => ({ userId: USER, version: '1', catalog: CATALOG });
function setup(initial: unknown = null) {
  let value = initial;
  let clears = 0;
  const cache = {
    read: () => Promise.resolve(value),
    write: (entry: CacheEntry) => {
      value = entry;
      return Promise.resolve();
    },
    clear: () => {
      clears++;
      value = null;
      return Promise.resolve();
    },
  };
  const store = new CatalogStore(cache);
  return { store, cache, value: () => value, clears: () => clears };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('versioned catalog loading', () => {
  it('requests one snapshot, reconstructs references and precomputes searchable labels', async () => {
    const calls: string[] = [];
    const client = new DataClient({
      baseUrl: 'https://test.invalid',
      publicKey: 'key',
      token: 'token',
      fetcher: (input, init) => {
        calls.push(input instanceof Request ? input.url : input.toString());
        assert.deepEqual(JSON.parse(typeof init?.body === 'string' ? init.body : ''), {
          known_version: null,
        });
        return Promise.resolve(Response.json(full()));
      },
    });
    const { store, value } = setup();
    const state = await store.load(
      (known_version) => client.rpc('catalog_snapshot', { known_version }),
      USER,
    );
    assert.equal(calls.length, 1);
    assert.match(calls.join(''), /rpc\/catalog_snapshot$/);
    assert.equal(state.suppliers[0]?.memberships[0]?.registryId, REGISTRY);
    assert.deepEqual(state.suppliers[0].normalizedNames, ['ספק']);
    assert.equal((value() as CacheEntry).version, '1');
  });
  it('shows a same-user cache before the server replies and reuses an unchanged response', async () => {
    const { store } = setup(saved());
    const response = deferred<unknown>();
    let preview = false;
    store.subscribe(() => {
      if (store.getSnapshot().refreshing && store.getSnapshot().suppliers.length) preview = true;
    });
    const loading = store.load((version) => {
      assert.equal(version, '1');
      assert.equal(preview, true);
      response.resolve({ user_id: USER, version: '1', access: ACCESS, unchanged: true });
      return response.promise;
    }, USER);
    const result = await loading;
    assert.equal(result.refreshing, false);
    assert.equal(result.suppliers.length, 1);
  });
  it('replaces stale data, but never accepts unchanged without the exact cache version', async () => {
    const { store } = setup(saved());
    await store.load(() => Promise.resolve(full('2')), USER);
    await assert.rejects(
      store.load(
        () =>
          Promise.resolve({
            user_id: USER,
            version: '3',
            access: ACCESS,
            unchanged: true,
          }),
        USER,
      ),
    );
    const empty = setup();
    await assert.rejects(
      empty.store.load(
        () =>
          Promise.resolve({
            user_id: USER,
            version: '1',
            access: ACCESS,
            unchanged: true,
          }),
        USER,
      ),
    );
  });
  for (const state of ['pending', 'blocked', 'rejected', 'unregistered'] as const) {
    it(`purges a cached catalog when access becomes ${state}`, async () => {
      const { store, value, clears } = setup(saved());
      const result = await store.load(
        () =>
          Promise.resolve({
            user_id: USER,
            version: '2',
            access: { ...ACCESS, state, member: false },
          }),
        USER,
      );
      assert.equal(result.catalog, null);
      assert.deepEqual(result.suppliers, []);
      assert.equal(value(), null);
      assert.equal(clears(), 1);
    });
  }
  for (const status of [401, 403]) {
    it(`purges data for HTTP ${String(status)}`, async () => {
      const { store, value } = setup(saved());
      await assert.rejects(store.load(() => Promise.reject(new DataError(status)), USER));
      assert.equal(store.getSnapshot().catalog, null);
      assert.equal(value(), null);
    });
  }
  it('rejects another user cache and server subject, and ignores a response after logout', async () => {
    const { store } = setup({ ...saved(), userId: SUPPLIER });
    await assert.rejects(store.load(() => Promise.resolve({ ...full(), user_id: SUPPLIER }), USER));
    assert.equal(store.getSnapshot().catalog, null);
    const response = deferred<unknown>();
    const started = deferred<undefined>();
    const loading = store.load(() => {
      started.resolve(undefined);
      return response.promise;
    }, USER);
    await started.promise;
    await store.clear();
    response.resolve(full());
    await assert.rejects(loading);
    assert.equal(store.getSnapshot().catalog, null);
  });
  it('works without persistence and rejects corrupt tuples before building a model', async () => {
    const cache = catalogCache(undefined);
    const store = new CatalogStore(cache);
    assert.equal((await store.load(() => Promise.resolve(full()), USER)).suppliers.length, 1);
    assert.equal(
      snapshotSchema.safeParse({ ...full(), catalog: { ...CATALOG, suppliers: [['bad']] } })
        .success,
      false,
    );
    assert.equal(expandCatalog(CATALOG).memberships[0]?.supplier_id, SUPPLIER);
    const broken = new CatalogStore({
      read: () => Promise.reject(Error()),
      write: () => Promise.reject(Error()),
      clear: () => Promise.resolve(),
    });
    assert.equal((await broken.load(() => Promise.resolve(full()), USER)).suppliers.length, 1);
  });
});
