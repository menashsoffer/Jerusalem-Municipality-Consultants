/* Draft category request view. The database remains authoritative for permissions. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DirectoryCategoryRequests = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  async function mount({container, api, user, forms, document: doc = document}) {
    if (!container || !api || !user || !user.id || !forms) throw new Error('missing_context');
    const el = (tag, text, attrs = {}) => {
      const node = doc.createElement(tag);
      if (text) node.textContent = text;
      for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
      return node;
    };
    const status = el('p', 'טוענים קטגוריות ובקשות…', {role: 'status', 'aria-live': 'polite'});
    container.replaceChildren(status);
    let categories, requests;
    try { [categories, requests] = await Promise.all([api.listCategories(), api.listMyCategoryRequests(user.id)]); }
    catch { status.textContent = 'לא ניתן לטעון את הקטגוריות. נסו שוב מאוחר יותר.'; return; }
    const heading = el('h2', 'בקשה להוספת קטגוריה');
    const form = el('form');
    function field(label, tag, attrs) {
      const wrapper = el('label', label); const control = el(tag, '', attrs); wrapper.append(control); form.append(wrapper); return control;
    }
    const name = field('שם מוצע', 'input', {name:'name', required:'', minlength:'2', maxlength:'200'});
    const parent = field('קטגוריה ראשית', 'select', {name:'parent'});
    const parentModel = forms.populateCategoryParents(parent, categories, (label, value) => el('option', label, {value}));
    const hint = el('p', '', {'aria-live':'polite'}); form.append(hint);
    name.addEventListener('input', () => {
      const matches = forms.similarCategoryNames(categories, name.value).slice(0, 5);
      hint.textContent = matches.length ? 'קטגוריות דומות שכבר קיימות: ' + matches.map(item => item.name).join(', ') : '';
    });
    const description = field('תיאור והצורך בקטגוריה', 'textarea', {name:'description', required:'', minlength:'5', maxlength:'2000'});
    const source = field('מקור או הפניה (לא חובה)', 'input', {name:'source', maxlength:'2000'});
    const submit = el('button', 'שליחת בקשה', {type:'submit'}); form.append(submit, status);
    const listHeading = el('h3', 'הבקשות שלי');
    const list = el('ul');
    const labels = {pending:'ממתינה לבדיקה', approved:'אושרה', linked:'קושרה לקטגוריה קיימת', rejected:'נדחתה'};
    function showRequests(rows) {
      list.replaceChildren();
      if (!rows.length) list.append(el('li', 'טרם נשלחו בקשות.'));
      for (const row of rows) {
        const item = el('li', row.proposed_name + ' — ' + (labels[row.status] || 'סטטוס לא ידוע'));
        if (row.decision_note) item.append(el('p', 'הערת מנהל: ' + row.decision_note));
        list.append(item);
      }
    }
    showRequests(requests); status.textContent = '';
    container.replaceChildren(heading, form, listHeading, list);
    let saving = false;
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (saving || !form.reportValidity()) return;
      if (!parentModel.validParent(parent.value)) { status.textContent = 'יש לבחור קטגוריה ראשית קיימת.'; return; }
      saving = true; submit.disabled = true; status.textContent = 'שולחים את הבקשה…';
      try {
        await api.submitCategoryRequest({userId:user.id, name:name.value, parentId:parent.value,
          description:description.value, sourceReference:source.value});
        form.reset(); hint.textContent = ''; status.textContent = 'הבקשה נשלחה וממתינה לבדיקה.';
        try { showRequests(await api.listMyCategoryRequests(user.id)); }
        catch { status.textContent += ' רענון רשימת הבקשות נכשל; אפשר לחזור אליה מאוחר יותר.'; }
      } catch { status.textContent = 'שליחת הבקשה נכשלה. בדקו את הפרטים ונסו שוב.'; }
      finally { saving = false; submit.disabled = false; }
    });
  }
  return Object.freeze({mount});
});
