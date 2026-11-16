import {
  normalizeSearch,
  validity,
  type Membership,
  type Supplier,
  type Validity,
} from './catalog-model.ts';

export interface Filters {
  query: string;
  registry: string;
  field: string;
  category: string;
  subcategory: string;
  unit: string;
  validity: Validity | '';
  today: string;
}

function categoryMatches(member: Membership, filters: Filters): boolean {
  if (!filters.category && !filters.subcategory) return true;
  return member.categories.some(
    (category) =>
      (!filters.category ||
        category.categoryId === filters.category ||
        category.parentCategoryId === filters.category) &&
      (!filters.subcategory || category.categoryId === filters.subcategory),
  );
}

function membershipMatches(member: Membership, filters: Filters): boolean {
  return (
    (!filters.registry || member.registryId === filters.registry) &&
    (!filters.field || member.fieldId === filters.field) &&
    categoryMatches(member, filters) &&
    (!filters.unit || member.unitId === filters.unit) &&
    (!filters.validity || validity(member, filters.today) === filters.validity)
  );
}

export function filterCatalog(suppliers: Supplier[], filters: Filters): Supplier[] {
  const query = normalizeSearch(filters.query);
  const hasFilters = !!(
    filters.registry ||
    filters.field ||
    filters.category ||
    filters.subcategory ||
    filters.unit ||
    filters.validity
  );
  return suppliers.filter((supplier) => {
    const members = supplier.memberships.filter((member) => membershipMatches(member, filters));
    if (hasFilters && members.length === 0) return false;
    if (!query) return true;
    return (
      (supplier.normalizedNames ?? [supplier.name, ...supplier.aliases].map(normalizeSearch)).some(
        (name) => name.includes(query),
      ) ||
      members.some((member) =>
        (member.normalizedField ?? normalizeSearch(member.field)).includes(query),
      )
    );
  });
}
