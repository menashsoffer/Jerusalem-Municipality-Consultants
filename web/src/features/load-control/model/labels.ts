const JOB_STATUS: Record<string, string> = { running: 'רץ', ok: 'הצליח', failed: 'נכשל' };
const REGISTRY_STATUS: Record<string, string> = {
  active: 'פעיל',
  closed: 'סגור',
  unknown: 'לא ידוע',
};
const SOURCES: Record<string, string> = {
  companies_registrar: 'רשם החברות',
  nonprofits_registrar: 'רשם העמותות',
  guidestar: 'גיידסטאר',
};

export function jobStatus(status: string): string {
  return JOB_STATUS[status] ?? status;
}
export function registryStatus(status: string): string {
  return REGISTRY_STATUS[status] ?? status;
}
export function sourceLabel(source: string): string {
  return SOURCES[source] ?? source;
}

const KINDS: Record<string, string> = {
  offline: 'אין חיבור לאינטרנט',
  timeout: 'השרת לא ענה בזמן',
  unavailable: 'מסד הנתונים לא זמין',
  system: 'תקלה במערכת',
  session: 'פג תוקף ההתחברות',
  forbidden: 'אין הרשאה',
  rule: 'ערך לא תקין',
  reason: 'סירוב עסקי',
  gone: 'כבר טופל או נמחק',
  duplicate: 'כבר קיים',
  rate_limit: 'יותר מדי פעולות',
  unconfirmed: 'לא ברור אם נשמר',
};
const SCREENS: Record<string, string> = {
  catalog: 'איתור ספקים',
  supplier: 'כרטיס ספק',
  categories: 'קטגוריות',
  identifiers: 'מזהי ספקים',
  admin: 'ניהול',
  'route-check': 'בדיקת מסלול',
  engagement: 'בקשות התקשרות',
  addresses: 'כתובות',
  'load-control': 'בקרת טעינה',
  users: 'משתמשים',
  thresholds: 'ספים',
  auth: 'האזור האישי',
  other: 'אחר',
};
export function kindLabel(kind: string): string {
  return KINDS[kind] ?? kind;
}
export function screenLabel(screen: string): string {
  return SCREENS[screen] ?? screen;
}

export { when } from '../../../lib/dates.ts';
