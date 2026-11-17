import type { Json } from '../../../database.types.ts';

/** Hebrew labels for the codes the database stores. Unknown codes fall back at the call site. */
export const ENTITY_KINDS: Record<string, string> = {
  unknown: 'לא ידוע',
  company: 'חברה',
  sole_trader: 'עוסק',
  nonprofit: 'עמותה',
  partnership: 'שותפות',
  public_body: 'גוף ציבורי',
  individual: 'אדם פרטי',
};
export const NAME_KINDS: Record<string, string> = {
  as_published: 'כפי שפורסם',
  trade_name: 'שם מסחרי',
  former_name: 'שם קודם',
  registrar_name: 'שם במרשם',
};
export const ID_SOURCES: Record<string, string> = {
  companies_registrar: 'רשם החברות',
  nonprofits_registrar: 'רשם העמותות',
  guidestar: 'גיידסטאר',
  municipality: 'העירייה',
  manual: 'הזנה ידנית',
};
/** Only the first three can be entered by hand; personal IDs are never collected. */
export const ID_TYPES: Record<string, string> = {
  company: 'מספר חברה',
  nonprofit: 'מספר עמותה',
  vat_dealer: 'עוסק מורשה',
  personal_id: 'מזהה אישי',
};
export const REVIEW: Record<string, string> = {
  verified: 'מאומת',
  needs_review: 'ממתין לאימות',
  rejected: 'נדחה',
  removed: 'הוסר',
};
export const CONTACT_KINDS: Record<string, string> = {
  phone: 'טלפון',
  email: 'דוא״ל',
  address: 'כתובת',
  website: 'אתר',
  contact_person: 'איש קשר',
};
const DATE_SOURCES: Record<string, string> = {
  registry_document: 'מסמך המאגר',
  internal_registry: 'המאגר הפנימי',
  municipal_registry: 'מאגר העירייה',
  unknown: 'לא תועד',
};
const OPERATIONS: Record<string, string> = {
  INSERT: 'נוספה רשומה',
  UPDATE: 'עודכנה רשומה',
  DELETE: 'נמחקה רשומה',
};
const TABLES: Record<string, string> = {
  suppliers: 'ספק',
  supplier_names: 'שם',
  supplier_identifiers: 'מזהה',
  supplier_contacts: 'פרט קשר',
  memberships: 'רישום במאגר',
};
const FIELDS: Record<string, string> = {
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

interface MembershipDates {
  registered_from: string | null;
  registered_until: string | null;
  engagement_started_on: string | null;
  dates_source: string;
}
export function membershipDates(item: MembershipDates): string {
  const dates = `רישום: ${item.registered_from ?? 'לא צוין'} עד ${item.registered_until ?? 'לא צוין'}`;
  const from = `תחילת התקשרות: ${item.engagement_started_on ?? 'לא צוין'}`;
  const origin = `מקור התאריכים: ${DATE_SOURCES[item.dates_source] ?? 'לא תועד'}`;
  return `${dates} · ${from} · ${origin}`;
}

/** The labelled names of the fields an audit entry changed, without their values. */
export function changedFields(changes: Json): string {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return '';
  const labels = Object.keys(changes).flatMap((key) => FIELDS[key] ?? []);
  return [...new Set(labels)].join(', ');
}

interface AuditEntry {
  operation: string;
  table_name: string;
  created_at: string;
  changes: Json;
}
export function auditLine(item: AuditEntry): string {
  const date = new Date(item.created_at).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
  const changed = changedFields(item.changes);
  const parts = [OPERATIONS[item.operation] ?? 'שינוי', TABLES[item.table_name] ?? 'רשומה', date];
  return [...parts, ...(changed ? [changed] : [])].join(' · ');
}

/** Only https links to source documents are shown; anything else is reported as unavailable. */
export function safeSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}
