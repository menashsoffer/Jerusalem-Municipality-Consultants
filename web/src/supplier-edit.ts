import type { SupplierDetail } from './data/supplier-detail.ts';
import { renameSupplier, replaceContact } from './data/site.ts';

function node<T extends keyof HTMLElementTagNameMap>(
  tag: T,
  text?: string,
): HTMLElementTagNameMap[T] {
  const result = document.createElement(tag);
  if (text) result.textContent = text;
  return result;
}
function message(container: HTMLElement): HTMLElement {
  const result = node('p');
  result.setAttribute('role', 'status');
  container.append(result);
  return result;
}
async function save(
  request: () => Promise<string>,
  refresh: () => Promise<void>,
  controls: { status: HTMLElement; button: HTMLButtonElement },
): Promise<void> {
  const { status, button } = controls;
  button.disabled = true;
  try {
    await request();
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'השמירה נכשלה.';
    button.disabled = false;
    return;
  }
  try {
    await refresh();
  } catch {
    status.textContent = 'השינוי נשמר, אך התצוגה לא התרעננה. יש לרענן לפני ניסיון נוסף.';
  }
}
function nameForm(container: HTMLElement, data: SupplierDetail, options: EditOptions): void {
  const form = node('form');
  const label = node('label', 'שינוי שם הספק');
  const value = node('input');
  value.value = data.supplier.display_name;
  value.required = true;
  value.maxLength = 300;
  label.append(value);
  const button = node('button', 'שמירת שם');
  button.type = 'submit';
  form.append(label, button);
  const status = message(form);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void save(
      () =>
        renameSupplier(options.token, {
          supplier_id: data.supplier.id,
          display_name: value.value.trim(),
        }),
      options.refresh,
      { status, button },
    );
  });
  container.append(form);
}
const CONTACTS: Record<string, string> = {
  phone: 'טלפון',
  email: 'דוא״ל',
  address: 'כתובת',
  website: 'אתר',
  contact_person: 'איש קשר',
};
interface EditOptions {
  token: string;
  refresh: () => Promise<void>;
}
function contactForm(container: HTMLElement, data: SupplierDetail, options: EditOptions): void {
  const form = node('form');
  const heading = node('h4', 'הוספה או עדכון פרט קשר');
  const existing = node('select');
  existing.append(new Option('פרט קשר חדש', ''));
  for (const item of data.contacts.filter((contact) => contact.status === 'current')) {
    existing.add(new Option(`${CONTACTS[item.kind] ?? 'פרט קשר'}: ${item.value}`, item.id));
  }
  const kind = node('select');
  for (const [value, label] of Object.entries(CONTACTS)) kind.add(new Option(label, value));
  const value = node('input');
  value.required = true;
  value.maxLength = 500;
  existing.addEventListener('change', () => {
    const selected = data.contacts.find((item) => item.id === existing.value);
    if (selected) {
      kind.value = selected.kind;
      value.value = selected.value;
    } else value.value = '';
    kind.disabled = !!selected;
  });
  const button = node('button', 'שמירת פרט קשר');
  button.type = 'submit';
  const label = node('label', 'פרט קשר קיים');
  label.append(existing);
  const kindLabel = node('label', 'סוג');
  kindLabel.append(kind);
  const valueLabel = node('label', 'ערך');
  valueLabel.append(value);
  form.append(heading, label, kindLabel, valueLabel, button);
  const status = message(form);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void save(
      () =>
        replaceContact(options.token, {
          supplier_id: data.supplier.id,
          contact_id: existing.value,
          kind: kind.value,
          value: value.value.trim(),
        }),
      options.refresh,
      { status, button },
    );
  });
  container.append(form);
}
export function attachEdits(
  container: HTMLElement,
  data: SupplierDetail,
  options: EditOptions,
): void {
  const section = node('section');
  section.append(node('h3', 'עריכת פרטי הספק'));
  nameForm(section, data, options);
  contactForm(section, data, options);
  container.append(section);
}
