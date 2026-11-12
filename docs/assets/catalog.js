/* Source labels are not proof of an approved category or contract. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SupplierCatalog = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const clean = value => typeof value === 'string' ? value.trim() : '';
  const sorted = values => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'he'));
  const registryNames = records => sorted(records.map(row => clean(row.registry)));
  const fieldsForRegistry = (records, registry) => sorted(records
    .filter(row => clean(row.registry) === registry)
    .map(row => clean(row.field)));
  const selectionExists = (records, registry, field) =>
    !!registry && !!field && fieldsForRegistry(records, registry).includes(field);

  async function loadAllSuppliers(fetcher, base, requestHeaders) {
    const records = [];
    const size = 500;
    let offset = 0;
    for (;;) {
      const params = new URLSearchParams({select: '*', order: 'id.asc', limit: String(size), offset: String(offset)});
      const response = await fetcher(base + '/rest/v1/suppliers?' + params, {headers: requestHeaders});
      if (!response.ok) throw new Error('database');
      const page = await response.json();
      if (!Array.isArray(page)) throw new Error('format');
      records.push(...page);
      if (page.length < size) return records;
      offset += page.length;
    }
  }

  return Object.freeze({registryNames, fieldsForRegistry, selectionExists, loadAllSuppliers});
});
