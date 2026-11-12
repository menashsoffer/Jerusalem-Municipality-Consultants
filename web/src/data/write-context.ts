import type { PublicSchema } from '../database.types.ts';
import { mayWriteUnit, type Access } from './access.ts';
import type { CatalogData } from './catalog.ts';
import type { DataClient } from './client.ts';

type Identifier = PublicSchema['supplier_identifiers']['Row'];
export interface RegistryOption {
  versionId: string;
  registryId: string;
  name: string;
  validFrom: string | null;
  validUntil: string | null;
}
export interface WriteContext {
  catalog: CatalogData;
  identifiers: Identifier[];
  versions: RegistryOption[];
}

export function writableVersions(catalog: CatalogData, access: Access): RegistryOption[] {
  const registries = new Map(catalog.registries.map((row) => [row.id, row]));
  return catalog.versions.flatMap((version) => {
    const registry = registries.get(version.registry_id);
    if (registry?.status !== 'active') return [];
    const permitted =
      access.state === 'active' &&
      (access.admin ||
        (registry.owner_unit_id !== null && mayWriteUnit(access, registry.owner_unit_id)));
    if (!permitted || !catalog.fields.some((field) => field.registry_id === registry.id)) return [];
    return [
      {
        versionId: version.id,
        registryId: registry.id,
        name: registry.name,
        validFrom: version.valid_from,
        validUntil: version.valid_until,
      },
    ];
  });
}

export async function loadWriteContext(
  client: DataClient,
  catalog: CatalogData,
  access: Access,
): Promise<WriteContext> {
  if (!access.editor || access.state !== 'active') throw new Error('אין לך הרשאה לערוך ספקים.');
  const identifiers = await client.list('supplier_identifiers', {
    scheme: 'in.(company,nonprofit,vat_dealer)',
    review_status: 'neq.rejected',
  });
  return { catalog, identifiers, versions: writableVersions(catalog, access) };
}
