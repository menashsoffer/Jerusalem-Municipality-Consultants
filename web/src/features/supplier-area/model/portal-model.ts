// What the supplier area shows and checks, without the network (supplier-portal-spec-he.md 5-6).
import { validCheckDigit } from '../../../lib/rules/israeli-id.ts';
import type { PortalAccount, PortalMe } from '../api/portal.ts';

export type Scheme = 'company' | 'nonprofit';

/** The scheme a 9-digit number belongs to, or a sentence on what is wrong with it. */
export function readIdentifier(raw: string): { scheme: Scheme; value: string } | { error: string } {
  const value = raw.replace(/[\s-]/g, '');
  if (!/^\d{9}$/.test(value)) return { error: 'יש להקליד את כל 9 הספרות, בלי אותיות.' };
  if (!validCheckDigit(value)) return { error: 'המספר לא תקין. בדקו שאין ספרה שגויה.' };
  return { scheme: value.startsWith('58') ? 'nonprofit' : 'company', value };
}

/** A proof file is a PDF or an image of up to 10MB (bucket limits, spec 7.4). */
export function proofProblem(
  file: Pick<File, 'size' | 'type'> | null,
  types: readonly string[],
  maxBytes: number,
): string | null {
  if (!file || file.size === 0) return 'יש לצרף קובץ.';
  if (!types.includes(file.type)) return 'אפשר לצרף רק PDF, JPEG או PNG.';
  if (file.size > maxBytes) return 'הקובץ גדול מ-10MB. צרפו קובץ קטן יותר.';
  return null;
}

export type AreaStep = 'person' | 'invites' | 'link' | 'file';

/** Which screen a signed-in person sees first. */
export function areaStep(me: PortalMe): AreaStep {
  if (!me.person) return 'person';
  if (me.accounts.some((a) => a.status === 'active')) return 'file';
  if (me.invites.length > 0) return 'invites';
  return 'link';
}

export const activeAccounts = (me: PortalMe): PortalAccount[] =>
  me.accounts.filter((a) => a.status === 'active');

/** Links that are not active, newest first, with one sentence each. */
export function accountNote(account: PortalAccount): string {
  if (account.status === 'pending') return 'הבקשה ממתינה לאישור העירייה.';
  const why = account.decision_note ? ` הסיבה: ${account.decision_note}` : '';
  if (account.status === 'rejected') return `הבקשה נדחתה.${why}`;
  if (account.status === 'revoked') return `השיוך בוטל בידי העירייה.${why}`;
  return '';
}

export const SCHEME_LABELS: Record<string, string> = {
  company: 'ח"פ',
  nonprofit: 'מספר עמותה',
  vat_dealer: 'מספר עוסק',
  personal_id: 'ת"ז',
};

export const CONTACT_LABELS: Record<string, string> = {
  email: 'דוא"ל',
  phone: 'טלפון',
  address: 'כתובת',
  website: 'אתר',
  contact_person: 'איש קשר',
};

/** "בתוקף עד", "הסתיים", or "מסתיים בקרוב" for a registration end date. */
export function validity(until: string | null, today: string): 'open' | 'soon' | 'ended' | 'valid' {
  if (!until) return 'open';
  if (until < today) return 'ended';
  const soon = new Date(`${today}T00:00:00Z`);
  soon.setUTCDate(soon.getUTCDate() + 60);
  return until <= soon.toISOString().slice(0, 10) ? 'soon' : 'valid';
}
