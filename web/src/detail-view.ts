import type { SupplierDetail } from './data/supplier-detail.ts';
import type { Json } from './database.types.ts';
import { detail } from './data/site.ts';

function element(tag: string, value: string, cls?: string): HTMLElement {
  const node = document.createElement(tag);
  node.textContent = value;
  if (cls) node.className = cls;
  return node;
}
function target(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element ${id}`);
  return node;
}
function dialog(): HTMLDialogElement {
  return target('supplier-dialog') as HTMLDialogElement;
}
function source(
  documents: SupplierDetail['documents'],
  id: string | null,
  page?: number | null,
): HTMLElement {
  const node = element('span', 'מקור: לא תועד');
  const item = documents.find((document) => document.id === id);
  if (!item) return node;
  node.textContent = 'מקור תועד; הקישור אינו זמין';
  try {
    const url = new URL(item.url);
    if (url.protocol !== 'https:') return node;
    const link = document.createElement('a');
    link.href = url.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = page ? `מסמך מקור · עמוד ${String(page)}` : 'מסמך מקור';
    node.replaceChildren('מקור: ', link);
  } catch {
    return node;
  }
  return node;
}
function section(container: HTMLElement, title: string): HTMLElement {
  const node = document.createElement('section');
  node.append(element('h3', title));
  container.append(node);
  return node;
}
function row(container: HTMLElement, text: string, origin: HTMLElement): void {
  const node = element('p', text);
  node.append(document.createElement('br'), origin);
  container.append(node);
}
function names(container: HTMLElement, data: SupplierDetail): void {
  const node = section(container, 'שמות');
  const kinds: Record<string, string> = {
    as_published: 'כפי שפורסם',
    trade_name: 'שם מסחרי',
    former_name: 'שם קודם',
    registrar_name: 'שם במרשם',
  };
  row(node, `שם מוצג: ${data.supplier.display_name}`, element('span', 'מקור: לא תועד ברשומת הספק'));
  if (!data.names.length) node.append(element('p', 'לא תועדו שמות נוספים.'));
  data.names.forEach((name) => {
    row(
      node,
      `${kinds[name.kind] ?? 'שם נוסף'}: ${name.name}`,
      source(data.documents, name.source_document_id),
    );
  });
}
function supplierInfo(container: HTMLElement, data: SupplierDetail): void {
  const node = section(container, 'פרטי הספק');
  const kinds: Record<string, string> = {
    company: 'חברה',
    sole_trader: 'עוסק',
    nonprofit: 'עמותה',
    partnership: 'שותפות',
    public_body: 'גוף ציבורי',
    individual: 'אדם פרטי',
    unknown: 'לא ידוע',
  };
  const unknown = () => element('span', 'מקור: לא תועד ברשומת הספק');
  row(node, `סוג ישות: ${kinds[data.supplier.entity_kind] ?? 'לא ידוע'}`, unknown());
  if (data.supplier.website) row(node, `אתר: ${data.supplier.website}`, unknown());
  if (data.supplier.note) row(node, `הערה: ${data.supplier.note}`, unknown());
}
const ID_SOURCES: Record<string, string> = {
  companies_registrar: 'רשם החברות',
  nonprofits_registrar: 'רשם העמותות',
  guidestar: 'גיידסטאר',
  municipality: 'העירייה',
  manual: 'הזנה ידנית',
};
const ID_TYPES: Record<string, string> = {
  company: 'מספר חברה',
  nonprofit: 'מספר עמותה',
  vat_dealer: 'עוסק מורשה',
  personal_id: 'מזהה אישי',
};
const REVIEW: Record<string, string> = {
  verified: 'מאומת',
  needs_review: 'ממתין לאימות',
  rejected: 'נדחה',
  removed: 'הוסר',
};
function identifiers(container: HTMLElement, data: SupplierDetail): void {
  const node = section(container, 'מזהים');
  if (!data.identifiers.length) node.append(element('p', 'לא תועדו מזהים שניתן להציג.'));
  data.identifiers.forEach((item) => {
    row(
      node,
      `${ID_TYPES[item.scheme] ?? 'מזהה'}: ${item.value} · ${REVIEW[item.review_status] ?? 'מצב לא ידוע'}`,
      element('span', `מקור: ${ID_SOURCES[item.source] ?? 'לא תועד'}`),
    );
  });
}
const CONTACT_LABELS: Record<string, string> = {
  phone: 'טלפון',
  email: 'דוא״ל',
  address: 'כתובת',
  website: 'אתר',
  contact_person: 'איש קשר',
};
function contacts(container: HTMLElement, data: SupplierDetail): void {
  const node = section(container, 'פרטי קשר');
  if (!data.contacts.length) node.append(element('p', 'לא תועדו פרטי קשר.'));
  data.contacts.forEach((item) => {
    row(
      node,
      `${CONTACT_LABELS[item.kind] ?? 'פרט קשר'}: ${item.value}${item.is_valid === false ? ' · לא תקין לפי בדיקה אוטומטית' : ''}`,
      source(data.documents, item.source_document_id),
    );
  });
}
const DATE_SOURCES: Record<string, string> = {
  registry_document: 'מסמך המאגר',
  internal_registry: 'המאגר הפנימי',
  municipal_registry: 'מאגר העירייה',
  unknown: 'לא תועד',
};
function membershipDates(item: SupplierDetail['memberships'][number]): string {
  const dates = `רישום: ${item.registered_from ?? 'לא צוין'} עד ${item.registered_until ?? 'לא צוין'}`;
  const from = `תחילת התקשרות: ${item.engagement_started_on ?? 'לא צוין'}`;
  const origin = `מקור התאריכים: ${DATE_SOURCES[item.dates_source] ?? 'לא תועד'}`;
  return `${dates} · ${from} · ${origin}`;
}
function membership(
  container: HTMLElement,
  data: SupplierDetail,
  item: SupplierDetail['memberships'][number],
): void {
  const version = data.versions.find((value) => value.id === item.registry_version_id);
  const registry = data.registries.find((value) => value.id === version?.registry_id);
  const field = data.fields.find((value) => value.id === item.registry_field_id);
  const node = element('div', '', 'supplier-membership');
  node.append(element('h4', registry?.name ?? 'מאגר לא זמין'));
  node.append(element('p', REVIEW[item.review_status] ?? 'מצב הרישום לא ידוע'));
  row(
    node,
    `תחום: ${field?.source_text ?? 'לא צוין'}`,
    source(data.documents, version?.source_document_id ?? null, item.source_page),
  );
  node.append(element('p', membershipDates(item)));
  container.append(node);
}
function memberships(container: HTMLElement, data: SupplierDetail): void {
  const node = section(container, 'רישום במאגרים');
  if (!data.memberships.length) node.append(element('p', 'אין רישומים שניתן להציג.'));
  data.memberships.forEach((item) => {
    membership(node, data, item);
  });
}
function history(container: HTMLElement, data: SupplierDetail): void {
  if (data.auditUnavailable) {
    section(container, 'היסטוריית שינויים').append(element('p', 'לא ניתן לטעון את יומן השינויים.'));
    return;
  }
  if (data.audit === null) return;
  const node = section(container, 'היסטוריית שינויים');
  if (!data.audit.length) node.append(element('p', 'לא נמצאו שינויים ביומן.'));
  data.audit.forEach((item) => {
    const operations: Record<string, string> = {
      INSERT: 'נוספה רשומה',
      UPDATE: 'עודכנה רשומה',
      DELETE: 'נמחקה רשומה',
    };
    const tables: Record<string, string> = {
      suppliers: 'ספק',
      supplier_names: 'שם',
      supplier_identifiers: 'מזהה',
      supplier_contacts: 'פרט קשר',
      memberships: 'רישום במאגר',
    };
    const date = new Date(item.created_at).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
    const changed = changedFields(item.changes);
    node.append(
      element(
        'p',
        `${operations[item.operation] ?? 'שינוי'} · ${tables[item.table_name] ?? 'רשומה'} · ${date}${changed ? ` · ${changed}` : ''}`,
      ),
    );
  });
}
function changedFields(changes: Json): string {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return '';
  const labels: Record<string, string> = {
    display_name: 'שם',
    name: 'שם',
    value: 'ערך',
    review_status: 'מצב אימות',
    registered_from: 'תחילת רישום',
    registered_until: 'סיום רישום',
    engagement_started_on: 'תחילת התקשרות',
    source: 'מקור',
    status: 'מצב',
    registry_field_id: 'תחום',
    note: 'הערה',
    website: 'אתר',
  };
  const fields = [
    ...new Set(
      Object.keys(changes)
        .map((key) => labels[key])
        .filter(Boolean),
    ),
  ];
  return fields.join(', ');
}
export function render(data: SupplierDetail): void {
  target('supplier-title').textContent = data.supplier.display_name;
  const content = target('supplier-content');
  content.replaceChildren();
  row(
    content,
    data.supplier.review_status === 'verified' ? 'ספק מאומת' : 'ספק לא מאומת',
    element('span', 'מקור: מצב האימות במערכת'),
  );
  supplierInfo(content, data);
  names(content, data);
  identifiers(content, data);
  contacts(content, data);
  memberships(content, data);
  history(content, data);
}
export async function open(id: string, token: string): Promise<void> {
  target('supplier-title').textContent = 'פרטי ספק';
  target('supplier-content').textContent = 'טוען פרטי ספק...';
  if (!dialog().open) dialog().showModal();
  try {
    render(await detail(token, id));
  } catch {
    target('supplier-content').textContent = 'לא ניתן לטעון את פרטי הספק. נסו שוב.';
  }
}
export function close(): void {
  dialog().close();
}
