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
