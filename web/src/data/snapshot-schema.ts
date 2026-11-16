import { z } from './validation.ts';
import type { CatalogData } from './catalog.ts';

const id = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const text = z.string();
const nullableText = text.nullable();
const nullableId = id.nullable();
export const accessSchema = z.object({
  state: z.enum(['active', 'pending', 'rejected', 'blocked', 'unregistered']),
  member: z.boolean(),
  admin: z.boolean(),
  editor: z.boolean(),
  manager: z.boolean(),
  grants: z.array(
    z.object({
      role: z.enum(['viewer', 'editor', 'unit_manager', 'admin', 'auditor']),
      unitId: nullableId,
    }),
  ),
});
const name = z.tuple([id, text, text, nullableId]);
const membership = z.tuple([
  id,
  id,
  nullableId,
  nullableText,
  z.number().int().positive().nullable(),
  nullableText,
  nullableText,
  nullableText,
  text,
  text,
]);
const contact = z.tuple([id, text, text, z.boolean().nullable(), nullableId]);
export const catalogSchema = z.object({
  suppliers: z.array(
    z.tuple([
      id,
      text,
      text,
      text,
      nullableText,
      text,
      nullableText,
      z.array(name),
      z.array(membership),
      z.array(contact),
    ]),
  ),
  registries: z.array(z.tuple([id, text, nullableId, text])),
  versions: z.array(z.tuple([id, id, nullableId, nullableText, nullableText])),
  fields: z.array(z.tuple([id, id, text])),
  categories: z.array(z.tuple([id, text, nullableId])),
  fieldCategories: z.array(z.tuple([id, id])),
  units: z.array(z.tuple([id, text])),
  documents: z.array(z.tuple([id, text])),
});
export const snapshotSchema = z.object({
  user_id: id,
  version: text.min(1),
  access: accessSchema,
  unchanged: z.literal(true).optional(),
  catalog: catalogSchema.optional(),
});
export type WireCatalog = z.infer<typeof catalogSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;

function memberships(raw: WireCatalog) {
  return raw.suppliers.flatMap((s) =>
    s[8].map(
      ([
        id,
        registry_version_id,
        registry_field_id,
        name_as_published,
        source_page,
        registered_from,
        registered_until,
        engagement_started_on,
        dates_source,
        review_status,
      ]) => ({
        id,
        supplier_id: s[0],
        registry_version_id,
        registry_field_id,
        name_as_published,
        source_page,
        registered_from,
        registered_until,
        engagement_started_on,
        dates_source,
        review_status,
      }),
    ),
  );
}
function children(raw: WireCatalog) {
  return {
    names: raw.suppliers.flatMap((s) =>
      s[7].map(([id, name, kind, source_document_id]) => ({
        id,
        supplier_id: s[0],
        name,
        kind,
        source_document_id,
      })),
    ),
    memberships: memberships(raw),
    contacts: raw.suppliers.flatMap((s) =>
      s[9].map(([id, kind, value, is_valid, source_document_id]) => ({
        id,
        supplier_id: s[0],
        kind,
        value,
        is_valid,
        source_document_id,
        status: 'current',
      })),
    ),
  };
}
/** Reinflate references once, preserving original IDs for existing writes and detail views. */
export function expandCatalog(raw: WireCatalog): CatalogData {
  return {
    ...children(raw),
    suppliers: raw.suppliers.map(
      ([id, display_name, entity_kind, status, website, review_status, note]) => ({
        id,
        display_name,
        entity_kind,
        status,
        website,
        review_status,
        note,
      }),
    ),
    registries: raw.registries.map(([id, name, owner_unit_id, status]) => ({
      id,
      name,
      owner_unit_id,
      status,
    })),
    versions: raw.versions.map(
      ([id, registry_id, source_document_id, valid_from, valid_until]) => ({
        id,
        registry_id,
        source_document_id,
        valid_from,
        valid_until,
      }),
    ),
    fields: raw.fields.map(([id, registry_id, source_text]) => ({ id, registry_id, source_text })),
    categories: raw.categories.map(([id, name, parent_id]) => ({ id, name, parent_id })),
    fieldCategories: raw.fieldCategories.map(([registry_field_id, category_id]) => ({
      registry_field_id,
      category_id,
    })),
    units: raw.units.map(([id, name]) => ({ id, name })),
    documents: raw.documents.map(([id, url]) => ({ id, url })),
  };
}
