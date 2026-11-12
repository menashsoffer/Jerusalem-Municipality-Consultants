import type { PublicSchema } from '../database.types.ts';
import type { Access } from './access.ts';
import type { CatalogData } from './catalog.ts';
import { DataError, type DataClient } from './client.ts';

type Row<T extends keyof PublicSchema> = PublicSchema[T]['Row'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export interface SupplierDetail {
  supplier: Row<'suppliers'>;
  names: Row<'supplier_names'>[];
  identifiers: Row<'supplier_identifiers'>[];
  contacts: Row<'supplier_contacts'>[];
  memberships: Row<'memberships'>[];
  versions: Row<'registry_versions'>[];
  registries: Row<'registries'>[];
  fields: Row<'registry_fields'>[];
  documents: Row<'source_documents'>[];
  audit: Row<'audit_log'>[] | null;
  auditUnavailable: boolean;
}

function canReadAudit(access: Access): boolean {
  return (
    access.state === 'active' &&
    (access.admin || access.grants.some((grant) => grant.role === 'auditor'))
  );
}

function relatedIds(detail: Omit<SupplierDetail, 'audit' | 'auditUnavailable'>): string[] {
  return [
    detail.supplier.id,
    ...detail.names.map((row) => row.id),
    ...detail.identifiers.map((row) => row.id),
    ...detail.contacts.map((row) => row.id),
    ...detail.memberships.map((row) => row.id),
  ];
}

async function loadAudit(
  client: DataClient,
  supplierId: string,
  ids: string[],
): Promise<Row<'audit_log'>[]> {
  const tables = 'in.(suppliers,supplier_names,supplier_identifiers,supplier_contacts,memberships)';
  const discovery = await client.list('audit_log', {
    table_name: tables,
    or: `(changes->supplier_id->>old.eq.${supplierId},changes->supplier_id->>new.eq.${supplierId})`,
  });
  const allIds = [...new Set([...ids, ...discovery.map((entry) => entry.row_id)])].filter((id) =>
    UUID.test(id),
  );
  const result: Row<'audit_log'>[] = [];
  for (let index = 0; index < allIds.length; index += 30) {
    const batch = allIds.slice(index, index + 30);
    const rows = await client.list('audit_log', {
      row_id: `in.(${batch.join(',')})`,
      table_name: tables,
    });
    result.push(...rows);
  }
  return result.sort((a, b) => b.created_at.localeCompare(a.created_at));
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
  const identifiers = await client.list('supplier_identifiers', {
    supplier_id: `eq.${supplier.id}`,
  });
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
  let audit: Row<'audit_log'>[] | null = null;
  let auditUnavailable = false;
  if (canReadAudit(options.access)) {
    try {
      audit = await loadAudit(client, supplier.id, relatedIds(detail));
    } catch {
      auditUnavailable = true;
    }
  }
  return { ...detail, audit, auditUnavailable };
}
