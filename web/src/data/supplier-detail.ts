import type { PublicSchema } from '../database.types.ts';
import type { Access } from './access.ts';
import type { CatalogData } from './catalog.ts';
import { detailSchema } from './supplier-detail-schema.ts';
import { DataError, type DataClient } from './client.ts';

type Row<T extends keyof PublicSchema> = PublicSchema[T]['Row'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export interface SupplierDetail {
  supplier: CatalogData['suppliers'][number];
  names: CatalogData['names'];
  identifiers: Row<'supplier_identifiers'>[];
  contacts: CatalogData['contacts'];
  memberships: CatalogData['memberships'];
  versions: CatalogData['versions'];
  registries: CatalogData['registries'];
  fields: CatalogData['fields'];
  documents: CatalogData['documents'];
  audit: Row<'audit_log'>[] | null;
  auditUnavailable: boolean;
}

export async function supplierDetail(
  client: DataClient,
  cached: CatalogData,
  options: { supplierId: string; access: Access },
): Promise<SupplierDetail> {
  if (!UUID.test(options.supplierId)) {
    throw new DataError(0);
  }
  const supplier = cached.suppliers.find((row) => row.id === options.supplierId);
  if (!supplier) throw new DataError(404);
  const result = detailSchema.safeParse(
    await client.rpc('supplier_detail', {
      supplier_id: supplier.id,
    }),
  );
  if (!result.success) throw new DataError(0);
  const { identifiers, audit } = result.data;
  const detail = {
    supplier,
    identifiers,
    names: cached.names.filter((row) => row.supplier_id === supplier.id),
    contacts: cached.contacts.filter((row) => row.supplier_id === supplier.id),
    memberships: cached.memberships.filter((row) => row.supplier_id === supplier.id),
    versions: cached.versions,
    registries: cached.registries,
    fields: cached.fields,
    documents: cached.documents,
  };
  return { ...detail, audit, auditUnavailable: false };
}
