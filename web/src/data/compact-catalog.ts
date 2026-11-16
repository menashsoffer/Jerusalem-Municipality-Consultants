import type { CatalogData } from './catalog.ts';
import { array, boolean, nullable, number, object, rows, text, tuple } from './parse.ts';
import { DataError } from './client.ts';

const optionalText = nullable(text);
const defaults =
  (fallback: string) =>
  (value: unknown): string =>
    value === null ? fallback : text(value);
const NAME = { name: text, kind: defaults('as_published'), source_document_id: optionalText };
const MEMBER = {
  registry_version_id: text,
  registry_field_id: optionalText,
  name_as_published: optionalText,
  source_page: nullable(number),
  registered_from: optionalText,
  registered_until: optionalText,
  engagement_started_on: optionalText,
  dates_source: defaults('unknown'),
  review_status: defaults('needs_review'),
};
const CONTACT = {
  id: text,
  kind: text,
  value: text,
  is_valid: nullable(boolean),
  source_document_id: optionalText,
};
const SUPPLIER = {
  id: text,
  display_name: text,
  entity_kind: defaults('unknown'),
  status: defaults('active'),
  website: optionalText,
  review_status: defaults('needs_review'),
  note: optionalText,
};

function inheritedName(value: unknown, index: number, name: string): unknown[] {
  const values = [...array(value)];
  if (values[index] === 0) values[index] = name;
  return values;
}

function supplier(value: unknown, result: CatalogData): void {
  const raw = array(value);
  if (raw.length !== 10) throw new DataError(0);
  const row = tuple(raw.slice(0, 7), SUPPLIER);
  result.suppliers.push(row);
  result.names.push(
    ...rows(
      array(raw[7]).map((value) => inheritedName(value, 0, row.display_name)),
      NAME,
    ).map((child) => ({ ...child, supplier_id: row.id })),
  );
  result.memberships.push(
    ...rows(
      array(raw[8]).map((value) => inheritedName(value, 2, row.display_name)),
      MEMBER,
    ).map((child) => ({ ...child, supplier_id: row.id })),
  );
  result.contacts.push(
    ...rows(raw[9], CONTACT).map((child) => ({
      ...child,
      supplier_id: row.id,
      status: 'current',
    })),
  );
}

/** See documentation/catalog-snapshot-contract-he.md for the ordered wire columns. */
export function compactCatalog(value: unknown): CatalogData {
  const raw = object(value);
  const result: CatalogData = {
    suppliers: [],
    names: [],
    memberships: [],
    contacts: [],
    registries: rows(raw.registries, {
      id: text,
      name: text,
      owner_unit_id: optionalText,
      status: text,
    }),
    versions: rows(raw.versions, {
      id: text,
      registry_id: text,
      source_document_id: optionalText,
      valid_from: optionalText,
      valid_until: optionalText,
    }),
    fields: rows(raw.fields, { id: text, registry_id: text, source_text: text }),
    categories: rows(raw.categories, { id: text, name: text, parent_id: optionalText }),
    fieldCategories: rows(raw.fieldCategories, { registry_field_id: text, category_id: text }),
    units: rows(raw.units, { id: text, name: text }),
    documents: rows(raw.documents, { id: text, url: text }),
  };
  for (const value of array(raw.suppliers)) supplier(value, result);
  return result;
}
