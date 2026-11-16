import assert from 'node:assert/strict';
import { it, mock } from 'node:test';

import { ChunkRenderer, yieldToMain } from '../src/render-chunks.ts';
import { buildCatalog } from '../src/catalog-model.ts';
import { compactCatalog } from '../src/data/compact-catalog.ts';
import * as view from '../src/catalog-view.ts';
import { deferred, wireCatalog } from './catalog-fixture.ts';
import { domFixture } from './dom-fixture.ts';

it('draws 100 immediately, yields between chunks and cancels the older continuation', async () => {
  const tasks: (() => void)[] = [];
  const renderer = new ChunkRenderer(
    () =>
      new Promise((resolve) => {
        tasks.push(resolve);
      }),
  );
  const chunks: number[][] = [];
  const old = renderer.draw(
    Array.from({ length: 350 }, (_, index) => index),
    (rows) => chunks.push(rows),
  );
  assert.equal(chunks[0]?.length, 100);
  assert.equal(chunks.length, 1);
  tasks.shift()?.();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(chunks[1]?.length, 100);
  const newer: number[][] = [];
  await renderer.draw([999], (rows) => newer.push(rows));
  tasks.shift()?.();
  await old;
  assert.equal(chunks.length, 2);
  assert.deepEqual(newer, [[999]]);
});

it('draws every remaining chunk, including the final incomplete one', async () => {
  let yields = 0;
  const renderer = new ChunkRenderer(() => {
    yields++;
    return Promise.resolve();
  });
  const chunks: number[] = [];
  await renderer.draw(
    Array.from({ length: 533 }, (_, index) => index),
    (rows) => chunks.push(rows.length),
  );
  assert.deepEqual(chunks, [100, 100, 100, 100, 100, 33]);
  assert.equal(yields, 5);
  await renderer.draw([], (rows, first) => {
    assert.deepEqual(rows, []);
    assert.equal(first, true);
  });
});

it('uses scheduler.yield with the scheduler receiver, and falls back to a promised timer', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'scheduler');
  const scheduler = {
    yield: function () {
      assert.equal(this, scheduler);
      return Promise.resolve();
    },
  };
  try {
    Object.defineProperty(globalThis, 'scheduler', { configurable: true, value: scheduler });
    await yieldToMain();
    Reflect.deleteProperty(globalThis, 'scheduler');
    mock.timers.enable({ apis: ['setTimeout'] });
    let completed = false;
    const pending = yieldToMain().then(() => {
      completed = true;
    });
    assert.equal(completed, false);
    mock.timers.tick(1);
    await pending;
    assert.equal(completed, true);
  } finally {
    mock.timers.reset();
    if (previous) Object.defineProperty(globalThis, 'scheduler', previous);
    else Reflect.deleteProperty(globalThis, 'scheduler');
  }
});

it('replaces partial DOM results when a new filter arrives', async () => {
  const dom = domFixture();
  const pending = deferred<undefined>();
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'scheduler');
  Object.defineProperty(globalThis, 'scheduler', {
    configurable: true,
    value: { yield: () => pending.promise },
  });
  try {
    const [supplier] = buildCatalog(compactCatalog(wireCatalog()));
    assert.ok(supplier);
    const rows = Array.from({ length: 533 }, (_, index) => ({
      ...supplier,
      id: `s${String(index)}`,
      name: `ספק ${String(index)}`,
    }));
    view.setSuppliers(rows);
    assert.equal(dom.el('#results').childElementCount, 100);
    assert.match(dom.el('#count').textContent, /533/);
    (dom.el('#query') as HTMLInputElement).value = 'אין תוצאות';
    view.render();
    pending.resolve(undefined);
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(dom.el('#results').childElementCount, 0);
    assert.equal(dom.el('#empty').hidden, false);
  } finally {
    view.setSuppliers([]);
    if (previous) Object.defineProperty(globalThis, 'scheduler', previous);
    else Reflect.deleteProperty(globalThis, 'scheduler');
    dom.close();
  }
});

it('narrows subcategories to their root and clears an obsolete selection', () => {
  const dom = domFixture();
  try {
    const [supplier] = buildCatalog(compactCatalog(wireCatalog()));
    assert.ok(supplier);
    view.setSuppliers([supplier]);
    const root = dom.el('#category-filter') as HTMLSelectElement;
    const child = dom.el('#subcategory-filter') as HTMLSelectElement;
    assert.equal(child.disabled, true);
    root.value = 'root';
    view.options();
    assert.deepEqual(
      [...child.options].map((option) => option.value),
      ['', 'c1', 'c2'],
    );
    child.value = 'c1';
    view.render();
    assert.equal(dom.el('#results').childElementCount, 1);
    root.value = '';
    view.options();
    assert.equal(child.value, '');
    assert.equal(child.disabled, true);
  } finally {
    view.setSuppliers([]);
    dom.close();
  }
});
