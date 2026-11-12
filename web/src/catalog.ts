import type { PublicSchema } from './database.types.ts';

export type LegacySupplier = Pick<
  PublicSchema['legacy_suppliers']['Row'],
  'name' | 'registry' | 'field'
>;

const clean = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const sorted = (values: string[]): string[] =>
  [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'he'));
export const registryNames = (records: LegacySupplier[]): string[] =>
  sorted(records.map((row) => clean(row.registry)));
export const fieldsForRegistry = (records: LegacySupplier[], registry: string): string[] =>
  sorted(records.filter((row) => clean(row.registry) === registry).map((row) => clean(row.field)));
export const selectionExists = (
  records: LegacySupplier[],
  registry: string,
  field: string,
): boolean => !!registry && !!field && fieldsForRegistry(records, registry).includes(field);
const nameKey = (name: string): string =>
  clean(name)
    .normalize('NFKC')
    .toLocaleLowerCase('he')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
export const possibleDuplicates = (records: LegacySupplier[], name: string): LegacySupplier[] => {
  const key = nameKey(name);
  return key ? records.filter((row) => nameKey(row.name) === key) : [];
};

const TABLES = ['legacy_suppliers', 'suppliers'];
let table = TABLES[0] ?? 'legacy_suppliers';
export const tableName = (): string => table;

async function loadPage(
  fetcher: typeof fetch,
  base: string,
  options: { headers: HeadersInit; offset: number },
): Promise<unknown> {
  const { headers: requestHeaders, offset } = options;
  const params = new URLSearchParams({
    select: '*',
    order: 'id.asc',
    limit: '500',
    offset: String(offset),
  });
  for (const candidate of offset === 0 ? TABLES : [table]) {
    const response = await fetcher(`${base}/rest/v1/${candidate}?${params.toString()}`, {
      headers: requestHeaders,
    });
    if (response.status === 404 && offset === 0) continue;
    if (!response.ok) throw new Error('database');
    table = candidate;
    return response.json() as Promise<unknown>;
  }
  throw new Error('database');
}

export async function loadAllSuppliers(
  fetcher: typeof fetch,
  base: string,
  requestHeaders: HeadersInit,
): Promise<LegacySupplier[]> {
  const records: LegacySupplier[] = [];
  const size = 500;
  for (;;) {
    const page = await loadPage(fetcher, base, { headers: requestHeaders, offset: records.length });
    if (!Array.isArray(page)) throw new Error('format');
    records.push(...(page as LegacySupplier[]));
    if (page.length < size) return records;
  }
}
