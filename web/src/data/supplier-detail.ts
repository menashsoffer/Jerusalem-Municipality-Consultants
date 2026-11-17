import type { PublicSchema } from '../database.types.ts';
import type { CatalogData, ContactRow } from './catalog.ts';
import { DataError, type DataClient } from './client.ts';
import { array, boolean, json, nullable, number, object, record, text } from './parse.ts';

type Row<T extends keyof PublicSchema> = PublicSchema[T]['Row'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export interface SupplierDetail {
  supplier: CatalogData['suppliers'][number];
  names: CatalogData['names'];
  identifiers: Pick<
    Row<'supplier_identifiers'>,
    'id' | 'scheme' | 'value' | 'review_status' | 'source'
  >[];
  contacts: ContactRow[];
  memberships: CatalogData['memberships'];
  versions: CatalogData['versions'];
  registries: CatalogData['registries'];
  fields: CatalogData['fields'];
  documents: CatalogData['documents'];
  audit:
    | Pick<
        Row<'audit_log'>,
        'id' | 'table_name' | 'row_id' | 'operation' | 'changes' | 'created_at'
      >[]
    | null;
}

function parseContacts(value: unknown, supplierId: string): ContactRow[] {
  return array(value).map((item) => ({
    ...record(item, {
      id: text,
      kind: text,
      value: text,
      is_valid: nullable(boolean),
      source_document_id: nullable(text),
      status: text,
    }),
    supplier_id: supplierId,
  }));
}

export async function supplierDetail(
  client: DataClient,
  cached: CatalogData,
  supplierId: string,
): Promise<SupplierDetail> {
  if (!UUID.test(supplierId)) throw new DataError(0);
  const supplier = cached.suppliers.find((row) => row.id === supplierId);
  if (!supplier) throw new DataError(404);
  const raw = object(await client.rpc('supplier_detail', { supplier_id: supplierId }));
  const identifiers = array(raw.identifiers).map((value) =>
    record(value, {
      id: text,
      scheme: text,
      value: text,
      review_status: text,
      source: text,
    }),
  );
  const contacts = parseContacts(raw.contacts, supplierId);
  const audit =
    raw.audit === null
      ? null
      : array(raw.audit).map((value) =>
          record(value, {
            id: number,
            table_name: text,
            row_id: text,
            operation: text,
            changes: json,
            created_at: text,
          }),
        );
  return {
    supplier,
    identifiers,
    audit,
    names: cached.names.filter((row) => row.supplier_id === supplierId),
    contacts,
    memberships: cached.memberships.filter((row) => row.supplier_id === supplierId),
    versions: cached.versions,
    registries: cached.registries,
    fields: cached.fields,
    documents: cached.documents,
  };
}
