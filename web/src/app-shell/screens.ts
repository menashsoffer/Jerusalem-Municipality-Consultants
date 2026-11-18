// Which admin screens each user may open (ui-building-blocks-spec-he.md 8.1). The roles mirror
// each screen's own requireRoles check; the database enforces them again. An admin passes all.
import type { Access, Role } from '../data/access.ts';
import { permitted } from '../data/rpc.ts';
import { ROLE_LABELS } from '../features/auth/model/access-policy.ts';

export interface AdminScreen {
  to: string;
  title: string;
  description: string;
  roles: readonly Role[];
  group: 'work' | 'tools';
}

const EDITORS: readonly Role[] = ['editor', 'unit_manager'];

/** Waiting work first, then tools. A new admin screen adds its card here. */
export const ADMIN_SCREENS: readonly AdminScreen[] = [
  {
    to: '/users',
    title: 'משתמשים ותפקידים',
    description: 'מי נכנס לאתר ובאיזו הרשאה',
    roles: ['unit_manager'],
    group: 'work',
  },
  {
    to: '/identifiers',
    title: 'מועמדי מזהה ספק',
    description: 'אישור ח.פ. שנמצא לספק',
    roles: EDITORS,
    group: 'work',
  },
  {
    to: '/categories',
    title: 'בקשות קטגוריה',
    description: 'אישור תחומים ששויכו לספקים',
    roles: [],
    group: 'work',
  },
  {
    to: '/thresholds',
    title: 'אישור הסף החודשי',
    description: 'ספי ההתקשרות לפי מדד החודש',
    roles: [],
    group: 'work',
  },
  {
    to: '/addresses',
    title: 'כתובות לבדיקה',
    description: 'כתובות שלא אותרו במפה',
    roles: [],
    group: 'work',
  },
  {
    to: '/supplier/new',
    title: 'הוספת ספק למאגר',
    description: 'רישום ספק חדש באחד המאגרים',
    roles: EDITORS,
    group: 'tools',
  },
  {
    to: '/route-check',
    title: 'בדיקת מסלול ההתקשרות',
    description: 'חישוב מסלול בלי בקשה',
    roles: EDITORS,
    group: 'tools',
  },
  {
    to: '/load-control',
    title: 'בקרת טעינה',
    description: 'מה נטען מהמאגרים ומה חסר',
    roles: ['auditor'],
    group: 'tools',
  },
];

/** The admin screens this user may open; none before access is known. */
export function allowedScreens(access: Access | null | undefined): AdminScreen[] {
  if (!access) return [];
  return ADMIN_SCREENS.filter((screen) => permitted(access, screen.roles));
}

/** "מנהל יחידה או מנהל מערכת": who a screen is for, to explain a refusal. */
export function audienceOf(pathname: string): string | null {
  const screen = ADMIN_SCREENS.find((s) => pathname === s.to || pathname.startsWith(`${s.to}/`));
  if (!screen) return null;
  const names = [...screen.roles, 'admin' as const].map((role) => ROLE_LABELS[role]);
  return names.length > 1
    ? `${names.slice(0, -1).join(', ')} או ${names.at(-1) ?? ''}`
    : (names[0] ?? null);
}

/** The user's most senior role, for the account menu and refusals. */
export function mainRole(access: Access | null | undefined): string | null {
  if (access?.state !== 'active') return null;
  if (access.admin) return ROLE_LABELS.admin;
  const order: readonly Role[] = ['unit_manager', 'editor', 'auditor', 'viewer'];
  const role = order.find((r) => access.grants.some((g) => g.role === r));
  return role ? ROLE_LABELS[role] : null;
}
