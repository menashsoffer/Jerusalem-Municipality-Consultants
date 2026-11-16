import assert from 'node:assert/strict';
import { it } from 'node:test';

import { start } from '../src/app/app.ts';
import type { SiteApi } from '../src/app/deps.ts';
import { SESSION_KEY } from '../src/app/session.ts';
import type { Access } from '../src/data/access.ts';
import { DataError } from '../src/data/client.ts';
import type { CatalogState } from '../src/data/snapshot.ts';
import { buildCatalog } from '../src/catalog-model.ts';
import * as view from '../src/catalog-view.ts';
import { compactCatalog } from '../src/data/compact-catalog.ts';
import { access, deferred, TOKEN, USER, wireCatalog } from './catalog-fixture.ts';
import { domFixture } from './dom-fixture.ts';

function state(permission: Access): CatalogState {
  const catalog = permission.member ? compactCatalog(wireCatalog()) : null;
  return {
    userId: USER,
    version: '1:roles',
    access: permission,
    catalog,
    suppliers: catalog ? buildCatalog(catalog) : [],
    refreshing: false,
    timings: { request_ms: '1', model_ms: '2' },
  };
}

function siteFor(permission: Access, load = () => Promise.resolve(state(permission))): SiteApi {
  let listener: (state: CatalogState | null) => void = () => undefined;
  return {
    subscribe: (update) => {
      listener = update;
      return () => undefined;
    },
    BASE: 'https://db.test',
    canAddSupplier: () => permission.editor,
    loadSnapshot: async (_token, publish, onRequest) => {
      onRequest?.();
      const result = await load();
      listener(result);
      publish?.(result);
      return result;
    },
    clearCatalog: () => Promise.resolve(),
    catalog: () => Promise.resolve([]),
    eventRequest: (_token, events) => ({
      url: 'https://example.test/events',
      init: { method: 'POST', body: JSON.stringify(events) },
    }),
    exchangeCode: () => Promise.resolve(new Response(null, { status: 401 })),
    sendLink: () => Promise.resolve(new Response(null)),
  };
}

async function page(
  permission: Access,
  options: {
    session?: boolean;
    load?: () => Promise<CatalogState>;
    url?: string;
  } = {},
) {
  const dom = domFixture(options.url);
  dom.win.fetch = () => Promise.resolve(new Response(null));
  if (options.session !== false)
    dom.win.sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ token: TOKEN, exp: Date.now() + 60000 }),
    );
  const site = siteFor(permission, options.load);
  await start({
    win: dom.win,
    site,
    view,
    details: { open: () => Promise.resolve() },
    write: { bind: () => undefined, open: () => Promise.resolve() },
  });
  return dom;
}

it('shows waiting, blocked and active-without-role states without exposing the catalog', async () => {
  for (const status of ['pending', 'blocked', 'active'] as const) {
    const dom = await page(access({ state: status, member: false }));
    try {
      assert.equal(dom.el('#access-status').hidden, false);
      assert.equal(dom.el('#private-content').hidden, true);
      assert.equal(dom.el('#add-open').hidden, true);
      assert.equal(dom.el('#results').childElementCount, 0);
    } finally {
      dom.close();
    }
  }
});

it('shows the viewer catalog, searches precomputed aliases and opens supplier details', async () => {
  const dom = domFixture();
  dom.win.fetch = () => Promise.resolve(new Response(null));
  const batches: { event_type: string; details: Record<string, string> }[] = [];
  let opened = '';
  const site = siteFor(access());
  site.eventRequest = (_token, events) => {
    batches.push(...(events as typeof batches));
    return { url: 'https://example.test/events', init: {} };
  };
  dom.win.sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ token: TOKEN, exp: Date.now() + 60000 }),
  );
  try {
    await start({
      win: dom.win,
      site,
      view,
      details: {
        open: (id) => {
          opened = id;
          return Promise.resolve();
        },
      },
      write: { bind: () => undefined, open: () => Promise.resolve() },
    });
    assert.equal(dom.el('#private-content').hidden, false);
    assert.equal(dom.el('#add-open').hidden, true);
    (dom.el('#query') as HTMLInputElement).value = 'שם קודם';
    dom.el('#query').dispatchEvent(new dom.window.Event('input'));
    assert.match(dom.el('#results').textContent, /שם נוכחי/);
    (dom.el('.supplier-detail-open') as HTMLButtonElement).click();
    assert.equal(opened, '40000000-0000-0000-0000-000000000001');
    await site.loadSnapshot(TOKEN);
    dom.window.dispatchEvent(new dom.window.Event('pagehide'));
    assert.equal(batches.filter((event) => event.event_type === 'page_view').length, 1);
    assert.equal(batches.filter((event) => event.event_type === 'catalog_load').length, 2);
    const measured = batches.find((event) => event.event_type === 'catalog_load');
    assert.deepEqual(Object.keys(measured?.details ?? {}).sort(), [
      'model_ms',
      'render_ms',
      'request_ms',
    ]);
  } finally {
    dom.close();
  }
});

it('shows edit actions only after the server confirms editing access', async () => {
  const dom = await page(access({ admin: true, editor: true }));
  try {
    assert.equal(dom.el('#add-open').hidden, false);
  } finally {
    dom.close();
  }
});

it('keeps a failed network load recoverable and clears authentication on 401', async () => {
  for (const status of [0, 401]) {
    const dom = await page(access(), {
      load: () => Promise.reject(new DataError(status)),
    });
    try {
      assert.equal(dom.el('#private-content').hidden, true);
      if (status === 401) {
        assert.equal(dom.win.sessionStorage.getItem(SESSION_KEY), null);
        assert.equal((dom.el('#login-dialog') as HTMLDialogElement).open, true);
      } else {
        assert.ok(dom.win.sessionStorage.getItem(SESSION_KEY));
        assert.match(dom.el('#access-title').textContent, /אינו זמין/);
      }
    } finally {
      dom.close();
    }
  }
});

it('opens login without a session and explains an expired link or failed code exchange', async () => {
  for (const suffix of ['', '#error=access_denied&error_code=otp_expired', '?code=abc']) {
    const dom = await page(access(), { session: false, url: `https://example.test/app/${suffix}` });
    try {
      assert.equal((dom.el('#login-dialog') as HTMLDialogElement).open, true);
      assert.equal(dom.el('#private-content').hidden, true);
      if (suffix.startsWith('#')) assert.match(dom.el('#login-message').textContent, /תוקף ניסיון/);
      if (suffix.startsWith('?')) assert.match(dom.el('#login-message').textContent, /לא הושלמה/);
      assert.equal(dom.win.location.search + dom.win.location.hash, '');
    } finally {
      dom.close();
    }
  }
});

it('starts the snapshot request before event wiring and shows cached data while waiting', async () => {
  const dom = domFixture();
  dom.win.fetch = () => Promise.resolve(new Response(null));
  dom.win.sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ token: TOKEN, exp: Date.now() + 60000 }),
  );
  const pending = deferred<CatalogState>();
  const started = deferred<undefined>();
  const confirmed = state(access());
  const site = siteFor(access());
  const order: string[] = [];
  let publish: (state: CatalogState | null) => void = () => undefined;
  site.subscribe = (update) => {
    publish = update;
    return () => undefined;
  };
  site.loadSnapshot = async (_token, _publish, onRequest) => {
    order.push('request');
    onRequest?.();
    publish({ ...confirmed, access: null, refreshing: true });
    started.resolve(undefined);
    const result = await pending.promise;
    publish(result);
    return result;
  };
  try {
    const loading = start({
      win: dom.win,
      site,
      view,
      details: { open: () => Promise.resolve() },
      write: {
        bind: () => {
          order.push('bind');
        },
        open: () => Promise.resolve(),
      },
    });
    await started.promise;
    assert.equal(dom.el('#private-content').hidden, false);
    assert.equal(dom.el('#catalog-feedback').textContent, 'מתעדכן');
    assert.equal(dom.el('#add-open').hidden, true);
    pending.resolve(confirmed);
    await loading;
    assert.deepEqual(order, ['request', 'bind']);
    assert.equal(dom.el('#catalog-feedback').hidden, true);
  } finally {
    dom.close();
  }
});

it('closes private dialogs and removes cached detail content when membership is revoked', async () => {
  const dom = domFixture();
  dom.win.fetch = () => Promise.resolve(new Response(null));
  dom.win.sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ token: TOKEN, exp: Date.now() + 60000 }),
  );
  let result = state(access());
  const site = siteFor(access(), () => Promise.resolve(result));
  try {
    await start({
      win: dom.win,
      site,
      view,
      details: { open: () => Promise.resolve() },
      write: { bind: () => undefined, open: () => Promise.resolve() },
    });
    dom.el('#supplier-content').textContent = 'פרטים מהמטמון';
    (dom.el('#supplier-dialog') as HTMLDialogElement).showModal();
    (dom.el('#add-dialog') as HTMLDialogElement).showModal();
    result = state(access({ state: 'blocked', member: false }));
    await site.loadSnapshot(TOKEN);
    assert.equal(dom.el('#private-content').hidden, true);
    assert.equal((dom.el('#supplier-dialog') as HTMLDialogElement).open, false);
    assert.equal((dom.el('#add-dialog') as HTMLDialogElement).open, false);
    assert.equal(dom.el('#supplier-content').childElementCount, 0);
  } finally {
    dom.close();
  }
});
