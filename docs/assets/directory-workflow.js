/* Draft application coordinator. Server authorization always remains authoritative. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DirectoryWorkflow = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  async function initialize({api, user, views, ui}) {
    if (!api || !user || !user.id || !views || !ui) throw new Error('missing_context');
    ui.reset();
    let access;
    try { access = await api.getAccess(); }
    catch { ui.showError('לא ניתן לבדוק הרשאות כרגע. נסו שוב מאוחר יותר.'); return 'unavailable'; }
    if (!access.active) {
      ui.showEnrollment();
      await views.enrollment({api,user});
      return 'enrollment';
    }
    ui.showActive({canReviewProfiles:access.manageProfiles, canReviewCategories:access.admin, canAddSupplier:access.admin});
    const operations = [views.categories({api,user})];
    if (access.manageProfiles) operations.push(views.profileReview({api,user}));
    if (access.admin) operations.push(views.categoryReview({api,user}));
    const supplierLoad = Promise.resolve().then(() => views.loadSuppliers()).catch(() => {
      ui.showSupplierError('לא ניתן לטעון ספקים. בדקו הרשאות וחיבור ונסו שוב.');
    });
    await Promise.allSettled([...operations,supplierLoad]);
    return 'active';
  }
  return Object.freeze({initialize});
});
