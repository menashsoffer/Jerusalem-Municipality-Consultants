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
  const nameKey = name => clean(name).normalize('NFKC').toLocaleLowerCase('he')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
  const possibleDuplicates = (records, name) => {
    const key = nameKey(name);
    return key ? records.filter(row => nameKey(row.name) === key) : [];
  };

  // The flat table is renamed to legacy_suppliers by the 2026-11-12 migrations.
  // Until they are applied on the live project, fall back to the old name.
  const TABLES = ['legacy_suppliers', 'suppliers'];
  let table = TABLES[0];
  const tableName = () => table;

  async function loadPage(fetcher, base, requestHeaders, offset, size) {
    const params = new URLSearchParams({select: '*', order: 'id.asc', limit: String(size), offset: String(offset)});
    for (const candidate of offset === 0 ? TABLES : [table]) {
      const response = await fetcher(base + '/rest/v1/' + candidate + '?' + params, {headers: requestHeaders});
      if (response.status === 404 && offset === 0) continue;
      if (!response.ok) throw new Error('database');
      table = candidate;
      return response.json();
    }
    throw new Error('database');
  }

  async function loadAllSuppliers(fetcher, base, requestHeaders) {
    const records = [];
    const size = 500;
    let offset = 0;
    for (;;) {
      const page = await loadPage(fetcher, base, requestHeaders, offset, size);
      if (!Array.isArray(page)) throw new Error('format');
      records.push(...page);
      if (page.length < size) return records;
      offset += page.length;
    }
  }

  return Object.freeze({registryNames, fieldsForRegistry, selectionExists, possibleDuplicates, loadAllSuppliers, tableName});
});
