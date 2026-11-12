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
  units: Row<'org_units'>[];
  contacts: Row<'supplier_contacts'>[];
  documents: Row<'source_documents'>[];
}

export async function loadCatalog(client: DataClient): Promise<CatalogData> {
  const [suppliers, names, memberships, versions, registries, fields, units, contacts, documents] =
    await Promise.all([
      client.list('suppliers', { status: 'neq.merged' }),
      client.list('supplier_names'),
      client.list('memberships'),
      client.list('registry_versions'),
      client.list('registries'),
      client.list('registry_fields'),
      client.list('org_units'),
      client.list('supplier_contacts'),
      client.list('source_documents'),
    ]);
  return {
    suppliers,
    names,
    memberships,
    versions,
    registries,
    fields,
    units,
    contacts,
    documents,
  };
}
