import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { buildCatalog } from '../src/catalog-model.ts';
import { filterCatalog, type Filters } from '../src/catalog-filter.ts';
import { normalize } from '../src/catalog-search.ts';
import { compactCatalog } from '../src/data/compact-catalog.ts';
import { SUPPLIER, wireCatalog } from './catalog-fixture.ts';

const FILTERS: Filters = {
  query: '',
  registry: '',
  field: '',
  category: '',
  subcategory: '',
  unit: '',
  validity: '',
  today: '2026-11-16',
};

describe('compact catalog and precomputed search', () => {
  it('restores inherited names and encoded defaults without replacing genuinely missing names', () => {
    const catalog = compactCatalog({
      ...wireCatalog(),
      suppliers: [
        [
          SUPPLIER,
          'שם ספק',
          null,
          null,
          null,
          null,
          null,
          [[0, null, null]],
          [
            ['v1', 'f1', 0, null, null, null, null, null, null],
            ['v2', 'f2', null, null, null, null, null, null, null],
          ],
          [],
        ],
      ],
    });
    assert.equal(catalog.suppliers[0]?.entity_kind, 'unknown');
    assert.equal(catalog.suppliers[0].status, 'active');
    assert.equal(catalog.names[0]?.name, 'שם ספק');
    assert.equal(catalog.names[0].kind, 'as_published');
    assert.equal(catalog.memberships[0]?.name_as_published, 'שם ספק');
    assert.equal(catalog.memberships[0].dates_source, 'unknown');
    assert.equal(catalog.memberships[0].review_status, 'needs_review');
    assert.equal(catalog.memberships[1]?.name_as_published, null);
  });

  it('retains source information, dates, invalid contacts and all field categories', () => {
    const data = compactCatalog(wireCatalog());
    const [supplier] = buildCatalog(data);
    assert.ok(supplier);
    assert.equal(data.contacts[0]?.status, 'current');
    assert.equal(supplier.contacts[0]?.valid, false);
    assert.equal(supplier.memberships[0]?.source, 'https://example.test/source');
    assert.equal(supplier.memberships[0].validUntil, '2028-01-01');
    assert.deepEqual(
      supplier.memberships[0].categories.map((category) => category.categoryId),
      ['c1', 'c2'],
    );
    for (const subcategory of ['c1', 'c2']) {
      assert.equal(
        filterCatalog([supplier], { ...FILTERS, subcategory, category: 'root', registry: 'r1' })
          .length,
        1,
      );
      assert.equal(
        filterCatalog([supplier], { ...FILTERS, subcategory, registry: 'r2' }).length,
        0,
      );
    }
  });

  it('matches the former normalization behavior for names, aliases and filtered fields', () => {
    const suppliers = buildCatalog(compactCatalog(wireCatalog()));
    for (const query of [
      'שם נוכחי',
      'שם—קודם',
      'כתיב נוסף',
      'תכנון',
      'כבישים',
      'תְכנוּן',
      'missing',
      'שם!נוכחי',
      'ＳＴＲＩＮＧ',
      '',
    ]) {
      for (const registry of ['', 'r1', 'r2']) {
        const expected = suppliers.filter((supplier) => {
          const members = supplier.memberships.filter(
            (member) => !registry || member.registryId === registry,
          );
          if (registry && !members.length) return false;
          const term = normalize(query);
          return (
            !term ||
            [supplier.name, ...supplier.aliases].some((name) => normalize(name).includes(term)) ||
            members.some((member) => normalize(member.field).includes(term))
          );
        });
        assert.deepEqual(filterCatalog(suppliers, { ...FILTERS, query, registry }), expected);
      }
    }
  });

  it('normalizes only the query on each keystroke', () => {
    const suppliers = buildCatalog(compactCatalog(wireCatalog()));
    const spy = mock.method(String.prototype, 'normalize');
    try {
      filterCatalog(suppliers, { ...FILTERS, query: 'שם' });
      assert.equal(spy.mock.callCount(), 1);
    } finally {
      spy.mock.restore();
    }
  });

  it('rejects incomplete tuples and wrong column types before building a model', () => {
    assert.throws(() => compactCatalog({ ...wireCatalog(), registries: [['id']] }));
    const invalid = wireCatalog();
    assert.throws(() => compactCatalog({ ...invalid, suppliers: [[1, 'bad']] }));
  });
});
