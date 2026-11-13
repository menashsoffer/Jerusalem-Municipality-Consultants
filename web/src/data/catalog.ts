import type { PublicSchema } from '../database.types.ts';
import type { DataClient } from './client.ts';

type Row<T extends keyof PublicSchema> = PublicSchema[T]['Row'];
export interface CatalogData {
  suppliers: Row<'suppliers'>[];
  names: Row<'supplier_names'>[];
  memberships: Row<'memberships'>[];
  versions: Row<'registry_versions'>[];
  registries: Row<'registries'>[];
  fields: Row<'registry_fields'>[];
  categories: Row<'categories'>[];
  units: Row<'org_units'>[];
  contacts: Row<'supplier_contacts'>[];
  documents: Row<'source_documents'>[];
}

export async function loadCatalog(client: DataClient): Promise<CatalogData> {
  const [
    suppliers,
    names,
    memberships,
    versions,
    registries,
    fields,
    units,
    contacts,
    documents,
    categories,
  ] = await Promise.all([
    client.list('suppliers', { status: 'neq.merged' }),
    client.list('supplier_names'),
    client.list('memberships'),
    client.list('registry_versions'),
    client.list('registries'),
    client.list('registry_fields'),
    client.list('org_units'),
    client.list('supplier_contacts', { status: 'eq.current' }),
    client.list('source_documents'),
    client.list('categories', { active: 'eq.true' }),
  ]);
  return {
    suppliers,
    names,
    memberships,
    versions,
    registries,
    fields,
    categories,
    units,
    contacts,
    documents,
  };
}
