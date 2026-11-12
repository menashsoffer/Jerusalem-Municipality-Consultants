import { validity, type Membership, type Supplier, type Validity } from './catalog-model.ts';

export interface Filters {
  query: string;
  registry: string;
  field: string;
  unit: string;
  validity: Validity | '';
  today: string;
}

function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('he')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function membershipMatches(member: Membership, filters: Filters): boolean {
  return (
    (!filters.registry || member.registryId === filters.registry) &&
    (!filters.field || member.fieldId === filters.field) &&
    (!filters.unit || member.unitId === filters.unit) &&
    (!filters.validity || validity(member, filters.today) === filters.validity)
  );
}

export function filterCatalog(suppliers: Supplier[], filters: Filters): Supplier[] {
  const query = normalize(filters.query);
  const hasFilters = !!(filters.registry || filters.field || filters.unit || filters.validity);
  return suppliers.filter((supplier) => {
    const members = supplier.memberships.filter((member) => membershipMatches(member, filters));
    if (hasFilters && members.length === 0) return false;
    if (!query) return true;
    return (
      [supplier.name, ...supplier.aliases].some((name) => normalize(name).includes(query)) ||
      members.some((member) => normalize(member.field).includes(query))
    );
  });
}
