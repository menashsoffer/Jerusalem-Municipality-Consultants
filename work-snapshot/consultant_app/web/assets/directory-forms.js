/* Form helpers for the proposed approval workflow; server policies are authoritative. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DirectoryForms = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  function fill(select, placeholder, rows, makeOption = (label, value) => new Option(label, value)) {
    select.replaceChildren(makeOption(placeholder, ''));
    for (const row of rows) select.add(makeOption(row.name, row.id));
  }

  function mountUnitSelectors({units, administration, department, makeOption}) {
    const activeUnits = units.filter(unit => unit && typeof unit.id === 'string' && typeof unit.name === 'string');
    const administrations = activeUnits.filter(unit => unit.kind === 'administration' && !unit.parent_id);
    const departments = activeUnits.filter(unit => unit.kind === 'department' && unit.parent_id);
    fill(administration, 'בחרו מינהל', administrations, makeOption);
    function refresh() {
      const selectedAdmin = administrations.find(unit => unit.id === administration.value);
      const choices = selectedAdmin ? departments.filter(unit => unit.parent_id === selectedAdmin.id) : [];
      fill(department, selectedAdmin ? 'בחרו אגף' : 'בחרו תחילה מינהל', choices, makeOption);
      department.disabled = !selectedAdmin;
    }
    administration.addEventListener('change', refresh);
    refresh();
    return Object.freeze({
      selectedDepartment: () => departments.find(unit => unit.id === department.value && unit.parent_id === administration.value) || null,
      hasAdministrations: administrations.length > 0,
    });
  }

  function populateCategoryParents(select, categories, makeOption) {
    const roots = categories.filter(category => category && typeof category.id === 'string'
      && typeof category.name === 'string' && !category.parent_id);
    fill(select, 'קטגוריה ראשית חדשה', roots, makeOption);
    return Object.freeze({validParent: id => !id || roots.some(category => category.id === id)});
  }

  function similarCategoryNames(categories, proposed) {
    const key = String(proposed || '').trim().normalize('NFKC').toLocaleLowerCase('he');
    if (key.length < 2) return [];
    return categories.filter(category => typeof category.name === 'string'
      && category.name.trim().normalize('NFKC').toLocaleLowerCase('he').includes(key));
  }

  return Object.freeze({mountUnitSelectors, populateCategoryParents, similarCategoryNames});
});
