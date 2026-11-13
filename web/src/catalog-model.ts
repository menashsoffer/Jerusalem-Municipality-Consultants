import type { CatalogData } from './data/catalog.ts';

export type Validity = 'valid' | 'expired' | 'undated' | 'future';
export interface Membership {
  registryId: string;
  registry: string;
  fieldId: string | null;
  field: string;
  categoryId: string | null;
  categoryName: string;
  parentCategoryId: string | null;
  parentCategoryName: string;
  unitId: string | null;
  unit: string;
  validFrom: string | null;
  validUntil: string | null;
  source: string | null;
  page: number | null;
}
export interface Supplier {
  id: string;
  name: string;
  aliases: string[];
  verified: boolean;
  memberships: Membership[];
  contacts: { kind: string; value: string; valid: boolean | null }[];
}

export function validity(membership: Membership, today: string): Validity {
  if (membership.validFrom !== null && membership.validFrom > today) return 'future';
  if (membership.validUntil === null) return 'undated';
  return membership.validUntil < today ? 'expired' : 'valid';
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const row of rows) {
    const id = key(row);
    const group = result.get(id) ?? [];
    group.push(row);
    result.set(id, group);
  }
  return result;
}

function lookup(data: CatalogData) {
  return {
    versions: new Map(data.versions.map((row) => [row.id, row])),
    registries: new Map(data.registries.map((row) => [row.id, row])),
    fields: new Map(data.fields.map((row) => [row.id, row])),
    categories: new Map(data.categories.map((row) => [row.id, row])),
    units: new Map(data.units.map((row) => [row.id, row])),
    documents: new Map(data.documents.map((row) => [row.id, row])),
  };
}

type Lookup = ReturnType<typeof lookup>;
type MemberRow = CatalogData['memberships'][number];
function optional<T>(map: Map<string, T>, key: string | null): T | undefined {
  return map.get(key ?? '');
}

function categoryLabels(categoryId: string | null, refs: Lookup) {
  const category = optional(refs.categories, categoryId);
  const parent = optional(refs.categories, category?.parent_id ?? null);
  return {
    categoryId: category?.id ?? null,
    categoryName: category?.name ?? '',
    ...parentLabels(parent),
  };
}

function parentLabels(parent: CatalogData['categories'][number] | undefined) {
  return { parentCategoryId: parent?.id ?? null, parentCategoryName: parent?.name ?? '' };
}

function labels(
  row: MemberRow,
  context: {
    registry: CatalogData['registries'][number];
    version: CatalogData['versions'][number];
  },
  refs: Lookup,
) {
  const { registry, version } = context;
  const field = optional(refs.fields, row.registry_field_id);
  const unit = optional(refs.units, registry.owner_unit_id);
  const document = optional(refs.documents, version.source_document_id);
  return {
    fieldId: field?.id ?? null,
    field: field?.source_text ?? '',

    unit: unit?.name ?? '',
    source: document?.url ?? null,
  };
}

function member(row: MemberRow, refs: Lookup): Membership | null {
  const version = refs.versions.get(row.registry_version_id);
  const registry = version && refs.registries.get(version.registry_id);
  if (!version || !registry) return null;
  return {
    registryId: registry.id,
    registry: registry.name,
    ...labels(row, { registry, version }, refs),
    ...categoryLabels(optional(refs.fields, row.registry_field_id)?.category_id ?? null, refs),
    unitId: registry.owner_unit_id,
    validFrom: row.registered_from,
    validUntil: row.registered_until,
    page: row.source_page,
  };
}

export function buildCatalog(data: CatalogData): Supplier[] {
  const refs = lookup(data);
  const names = groupBy(data.names, (row) => row.supplier_id);
  const memberships = groupBy(
    data.memberships.filter((row) => !['rejected', 'removed'].includes(row.review_status)),
    (row) => row.supplier_id,
  );
  const contacts = groupBy(data.contacts, (row) => row.supplier_id);
  return (
    data.suppliers
      .filter((row) => row.status !== 'merged')
      .map((row) => ({
        id: row.id,
        name: row.display_name,
        verified: row.review_status === 'verified',
        aliases: [
          ...(names.get(row.id) ?? []).map((name) => name.name),
          ...(memberships.get(row.id) ?? []).flatMap((item) =>
            item.name_as_published ? [item.name_as_published] : [],
          ),
        ],
        memberships: (memberships.get(row.id) ?? [])
          .map((item) => member(item, refs))
          .filter((item): item is Membership => item !== null),
        contacts: (contacts.get(row.id) ?? []).map((item) => ({
          kind: item.kind,
          value: item.value,
          valid: item.is_valid,
        })),
      }))
      // A supplier whose memberships are hidden by access rules must not be
      // displayed without the registry and source needed to interpret it.
      .filter((supplier) => supplier.memberships.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name, 'he'))
  );
}
