/* Filter normalized supplier associations without merging unrelated identities. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DirectorySearch = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const key = value => String(value || '').normalize('NFKC').trim().toLocaleLowerCase('he');
  function search({entities, memberships, assignments, categories, sources}, filters = {}) {
    const categoryById = new Map(categories.map(item => [item.id, item]));
    const sourceById = new Map(sources.map(item => [item.id, item]));
    const membershipCategories = new Map();
    for (const row of assignments) {
      if (!membershipCategories.has(row.membership_id)) membershipCategories.set(row.membership_id, new Set());
      membershipCategories.get(row.membership_id).add(row.category_id);
    }
    const matchingMemberships = new Map();
    const term = key(filters.query);
    const entitiesById = new Map(entities.map(item => [item.id, item]));
    for (const membership of memberships) {
      const entity = entitiesById.get(membership.entity_id);
      if (!entity) continue;
      const categoryIds = membershipCategories.get(membership.id) || new Set();
      if (filters.unitId && membership.owner_unit_id !== filters.unitId) continue;
      if (filters.sourceId && membership.source_id !== filters.sourceId) continue;
      if (filters.subcategoryId && !categoryIds.has(filters.subcategoryId)) continue;
      if (filters.categoryId && ![...categoryIds].some(id => id === filters.categoryId || categoryById.get(id)?.parent_id === filters.categoryId)) continue;
      const words = [entity.name, membership.original_name, membership.original_field,
        sourceById.get(membership.source_id)?.title, ...[...categoryIds].map(id => categoryById.get(id)?.name)];
      if (term && !words.some(word => key(word).includes(term))) continue;
      if (!matchingMemberships.has(entity.id)) matchingMemberships.set(entity.id, []);
      matchingMemberships.get(entity.id).push(membership);
    }
    return entities.filter(item => matchingMemberships.has(item.id)).map(entity => ({entity, memberships:matchingMemberships.get(entity.id)}));
  }
  return Object.freeze({search});
});
