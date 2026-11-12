/* Draft enrollment view. Mount only after authentication and schema deployment. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DirectoryEnrollment = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  async function mount({container, api, user, forms, document: doc = document}) {
    if (!container || !api || !user || !user.id || !forms) throw new Error('missing_context');
    const el = (tag, label, attrs = {}) => {
      const node = doc.createElement(tag);
      if (label) node.textContent = label;
      for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
      return node;
    };
    const message = el('p', '', {role: 'status', 'aria-live': 'polite'});
    container.replaceChildren(message);
    message.textContent = 'בודקים את פרטי הבקשה…';
    let profile, units;
    try { [profile, units] = await Promise.all([api.getProfile(user.id), api.listUnits()]); }
    catch { message.textContent = 'לא ניתן לטעון את הפרטים. נסו שוב מאוחר יותר.'; return; }
    if (profile) {
      const states = {pending: 'הבקשה ממתינה לבדיקת מנהל המערכת.', active: 'הבקשה אושרה.', rejected: 'הבקשה לא אושרה. פנו למנהל המערכת.', blocked: 'הגישה לחשבון הושבתה. פנו למנהל המערכת.'};
      message.textContent = states[profile.status] || 'לא ניתן לקבוע את מצב הבקשה. פנו למנהל המערכת.';
      return;
    }
    const form = el('form');
    const heading = el('h2', 'בקשת הצטרפות לעובדי העירייה');
    const info = el('p', 'הבקשה נבדקת לפני מתן גישה למאגר.');
    form.append(heading, info);
    function input(label, name, type, options = {}) {
      const wrapper = el('label', label);
      const field = el(type === 'textarea' ? 'textarea' : 'input', '', {name, ...(type !== 'textarea' ? {type} : {}), ...options});
      wrapper.append(field); form.append(wrapper); return field;
    }
    const firstName = input('שם פרטי', 'firstName', 'text', {required: '', maxlength: '100', autocomplete: 'given-name'});
    const lastName = input('שם משפחה', 'lastName', 'text', {required: '', maxlength: '100', autocomplete: 'family-name'});
    const jobTitle = input('תפקיד בעירייה', 'jobTitle', 'text', {required: '', maxlength: '200', autocomplete: 'organization-title'});
    const phone = input('טלפון ליצירת קשר', 'phone', 'tel', {maxlength: '80', autocomplete: 'tel'});
    const adminLabel = el('label', 'מינהל'); const administration = el('select', '', {required: '', name: 'administration'}); adminLabel.append(administration); form.append(adminLabel);
    const unitLabel = el('label', 'אגף'); const department = el('select', '', {required: '', name: 'department'}); unitLabel.append(department); form.append(unitLabel);
    const purpose = input('מטרת השימוש במאגר', 'purpose', 'textarea', {required: '', minlength: '5', maxlength: '1000'});
    const submit = el('button', 'שליחת בקשה', {type: 'submit'}); form.append(submit, message); container.replaceChildren(form);
    const selectors = forms.mountUnitSelectors({units, administration, department, makeOption: (label, value) => el('option', label, {value})});
    if (!selectors.hasAdministrations) { message.textContent = 'טרם הוגדרו יחידות מאומתות. פנו למנהל המערכת.'; submit.disabled = true; return; }
    message.textContent = '';
    let saving = false;
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (saving || !form.reportValidity()) return;
      const selected = selectors.selectedDepartment();
      if (!selected) { message.textContent = 'יש לבחור אגף מתוך המינהל שנבחר.'; return; }
      saving = true; submit.disabled = true; message.textContent = 'שולחים את הבקשה…';
      try {
        await api.submitProfile({userId: user.id, firstName: firstName.value, lastName: lastName.value,
          jobTitle: jobTitle.value, phone: phone.value, unitId: selected.id, purpose: purpose.value});
        container.replaceChildren(el('p', 'הבקשה נשלחה וממתינה לבדיקת מנהל המערכת.', {role: 'status'}));
      } catch { message.textContent = 'שליחת הבקשה נכשלה. בדקו את הפרטים ונסו שוב.'; submit.disabled = false; saving = false; }
    });
  }
  return Object.freeze({mount});
});
