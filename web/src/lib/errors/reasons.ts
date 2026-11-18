/**
 * Refusals the database and the Edge Functions send as `reason:<key>`
 * (error-handling-spec-he.md section 6). Each text says why and what to do now.
 * tests/reasons-contract-test.ts checks that every key raised on the server is here and
 * that every key here is raised somewhere.
 */
export const REASON_MESSAGES = {
  last_admin: 'אי אפשר להסיר את מנהל המערכת האחרון. קודם הוסיפו מנהל מערכת נוסף.',
  role_already_removed: 'התפקיד כבר הוסר. רעננו את הרשימה.',
  no_active_profile: 'למשתמש אין חשבון פעיל. קודם אשרו את בקשת ההצטרפות שלו.',
  identifier_taken: 'המספר הזה כבר רשום אצל ספק אחר. פתחו את הספק ההוא ובדקו אם זה אותו ספק.',
  supplier_inactive: 'הספק מסומן כלא פעיל. סמנו אותו כפעיל לפני השינוי.',
  supplier_unavailable: 'הספק לא נמצא או אוחד עם ספק אחר. חפשו אותו מחדש באיתור ספקים.',
  already_decided: 'כבר הוחלט על הפריט הזה, אולי על ידי מישהו אחר. רעננו את הרשימה.',
  reason_required: 'צריך לכתוב סיבה לדחייה.',
  threshold_start_day: 'סף חדש מתחיל ב-16 בחודש. בחרו תאריך התחלה ב-16.',
  choose_active_category: 'הקטגוריה שנבחרה לא פעילה. בחרו קטגוריה פעילה.',
  self_verification: 'אי אפשר לאמת שורה שאתם הזנתם. מנהל יחידה אחר או מנהל מערכת צריך לאמת אותה.',
  no_thresholds:
    'אין סף מכרז מאושר לתאריך הזה. בחרו תאריך אחר, או בקשו ממנהל מערכת לאשר את הסף החודשי.',
} as const;

export type ReasonKey = keyof typeof REASON_MESSAGES;

/** The Hebrew text for a server message `reason:<key>`, or null for any other message. */
export function reasonMessage(message: string): string | null {
  const key = /^reason:([a-z_]+)$/.exec(message.trim())?.[1] ?? '';
  return Object.hasOwn(REASON_MESSAGES, key) ? REASON_MESSAGES[key as ReasonKey] : null;
}
