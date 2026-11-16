import type { DataClient } from './client.ts';
import type { PublicSchema } from '../database.types.ts';

type Row<T extends keyof PublicSchema, K extends keyof PublicSchema[T]['Row']> = Pick<
  PublicSchema[T]['Row'],
  K
>;

/** Only columns delivered by catalog_snapshot; no invented values for omitted DB columns. */
export interface CatalogData {
  suppliers: Row<
    'suppliers',
    'id' | 'display_name' | 'entity_kind' | 'status' | 'website' | 'review_status' | 'note'
  >[];
  names: Row<'supplier_names', 'id' | 'supplier_id' | 'name' | 'kind' | 'source_document_id'>[];
  memberships: Row<
    'memberships',
    | 'id'
    | 'supplier_id'
    | 'registry_version_id'
    | 'registry_field_id'
    | 'name_as_published'
    | 'source_page'
    | 'registered_from'
    | 'registered_until'
    | 'engagement_started_on'
    | 'dates_source'
    | 'review_status'
  >[];
  contacts: Row<
    'supplier_contacts',
    'id' | 'supplier_id' | 'kind' | 'value' | 'is_valid' | 'source_document_id' | 'status'
  >[];
  versions: Row<
    'registry_versions',
    'id' | 'registry_id' | 'source_document_id' | 'valid_from' | 'valid_until'
  >[];
  registries: Row<'registries', 'id' | 'name' | 'owner_unit_id' | 'status'>[];
  fields: Row<'registry_fields', 'id' | 'registry_id' | 'source_text'>[];
  fieldCategories: Row<'registry_field_categories', 'registry_field_id' | 'category_id'>[];
  categories: Row<'categories', 'id' | 'name' | 'parent_id'>[];
  units: Row<'org_units', 'id' | 'name'>[];
  documents: Row<'source_documents', 'id' | 'url'>[];
}

export async function loadCatalog(client: DataClient): Promise<CatalogData> {
  const { snapshotSchema, expandCatalog } = await import('./snapshot-schema.ts');
  const result = snapshotSchema.safeParse(await client.rpc('catalog_snapshot'));
  if (!result.success || !result.data.catalog) throw new Error('לא ניתן לטעון את הקטלוג.');
  return expandCatalog(result.data.catalog);
}
