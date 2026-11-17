import { suppliers } from './fixture.ts';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { optionsFor, emptyFilters, changeFilter, reconcile, sourceUrl } from '../model/filters.ts';
describe('catalog filter choices', () => {
  it('deduplicates roots and offers children only under the selected root', () => {
    const options = optionsFor(suppliers(), { registry: 'r1', category: 'root' });
    assert.deepEqual(options.category, [{ value: 'root', label: 'הנדסה' }]);
    assert.deepEqual(
      options.subcategory.map((c) => c.value),
      ['c1', 'c2'],
    );
  });
  it('resets incompatible fields, units and categories on registry change', () => {
    const current = {
      ...emptyFilters('2026-11-16'),
      registry: 'r1',
      field: 'f1',
      category: 'root',
      subcategory: 'c1',
      unit: 'u1',
      query: 'שם קודם',
    };
    assert.deepEqual(changeFilter(current, { key: 'registry', value: 'r2' }, suppliers()), {
      ...emptyFilters('2026-11-16'),
      registry: 'r2',
      query: 'שם קודם',
    });
  });
  it('removes disappeared selections after a refreshed catalog', () => {
    const current = {
      ...emptyFilters('2026-11-16'),
      registry: 'gone',
      field: 'gone',
      unit: 'gone',
    };
    assert.deepEqual(reconcile(current, suppliers()), emptyFilters('2026-11-16'));
  });
  it('allows only HTTPS source links', () => {
    assert.equal(sourceUrl('https://example.test/source'), 'https://example.test/source');
    for (const value of [null, 'javascript:alert(1)', 'http://example.test', 'not a URL'])
      assert.equal(sourceUrl(value), null);
  });
});
