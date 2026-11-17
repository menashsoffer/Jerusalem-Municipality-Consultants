import type { SupplierDetail } from '../../../data/supplier-detail.ts';
import type { SupplierUpdate } from '../../../data/site.ts';
import { check, supplierEditForm, type FieldErrors } from '../../../lib/rules/forms.ts';
import { formText } from './add-form.ts';

/** Form field names: the name, one input per current contact, and one new contact. */
export const NAME = 'display_name';
export const NEW_KIND = 'new_kind';
export const NEW_VALUE = 'new_value';
export const contactField = (id: string) => `contact:${id}`;

type Contact = SupplierDetail['contacts'][number];
export type EditResult = { update: SupplierUpdate } | { errors: FieldErrors } | { unchanged: true };

/** Which inputs the contacts in the request came from, so an error lands on its field. */
function contactRows(form: FormData, current: readonly Contact[]) {
  const rows = current.map((item) => ({
    field: contactField(item.id),
    contact: { contact_id: item.id, kind: item.kind, value: formText(form, contactField(item.id)) },
    before: item.value,
  }));
  const value = formText(form, NEW_VALUE);
  const kind = formText(form, NEW_KIND);
  if (value || kind) {
    rows.push({ field: NEW_VALUE, contact: { contact_id: '', kind, value }, before: '' });
  }
  return rows;
}

type Row = ReturnType<typeof contactRows>[number];
/** Moves an error from its request path (`contacts.1.value`) to the input it came from. */
function fieldErrors(errors: FieldErrors, rows: Row[]): FieldErrors {
  const result: FieldErrors = {};
  for (const [path, message] of Object.entries(errors)) {
    const index = /^contacts\.(\d+)\./.exec(path)?.[1];
    const row = index === undefined ? undefined : rows[Number(index)];
    const field = row ? (path.endsWith('.kind') ? NEW_KIND : row.field) : path;
    result[field] ??= message;
  }
  return result;
}

/**
 * Checks the whole dialog with the shared rules and sends only what changed: the name when it
 * differs, and each contact whose value differs. Nothing changed means no request at all.
 */
export function parseEditForm(form: FormData, data: SupplierDetail): EditResult {
  const current = data.contacts.filter((item) => item.status === 'current');
  const rows = contactRows(form, current);
  const checked = check(supplierEditForm, {
    display_name: formText(form, NAME),
    contacts: rows.map((row) => row.contact),
  });
  if (!checked.ok) return { errors: fieldErrors(checked.errors, rows) };
  const { display_name: name, contacts } = checked.value;
  const changed = contacts.filter((contact, index) => contact.value !== rows[index]?.before);
  const renamed = name !== data.supplier.display_name;
  if (!renamed && changed.length === 0) return { unchanged: true };
  return {
    update: {
      supplier_id: data.supplier.id,
      ...(renamed ? { display_name: name } : {}),
      contacts: changed,
    },
  };
}
