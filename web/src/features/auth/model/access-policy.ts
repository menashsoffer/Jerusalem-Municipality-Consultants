import type { Access, Role } from '../../../data/access.ts';
export const ACCESS_MESSAGES: Record<Access['state'], string> = {
  pending: 'הבקשה ממתינה לאישור מנהל.',
  blocked: 'הגישה חסומה. יש לפנות למנהל המערכת.',
  rejected: 'בקשת הגישה נדחתה. יש לפנות למנהל המערכת.',
  unregistered: 'נדרשת בקשת גישה. יש לפנות למנהל המערכת.',
  active: 'ההתחברות פעילה.',
};
export const ROLE_LABELS: Record<Role, string> = {
  viewer: 'צופה',
  editor: 'עורך',
  unit_manager: 'מנהל יחידה',
  admin: 'מנהל מערכת',
  auditor: 'מבקר',
};
