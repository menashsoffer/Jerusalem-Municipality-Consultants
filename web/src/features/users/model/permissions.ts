import type { Access, Role } from '../../../data/access.ts';
import { grantInputSchema, type GrantInput, type GrantRow, type Unit } from '../api/users.ts';
export const ROLE_LABELS: Record<Role, string> = {
  viewer: 'צופה',
  editor: 'עורך',
  unit_manager: 'מנהל יחידה',
  admin: 'מנהל מערכת',
  auditor: 'מבקר',
};
export function availableUnits(units: Unit[], access: Access): Unit[] {
  return access.admin
    ? units
    : units.filter((u) =>
        access.grants.some((g) => g.role === 'unit_manager' && g.unitId === u.id),
      );
}
export function activeGrants(grants: GrantRow[], now: number): GrantRow[] {
  return grants.filter(
    (g) => g.revoked_at === null && (g.expires_at === null || Date.parse(g.expires_at) > now),
  );
}
export function globalRole(role: string): boolean {
  return role === 'admin' || role === 'auditor';
}
export function parseGrant(
  values: Record<string, unknown>,
  scope: { admin: boolean; units: Unit[] },
) {
  const parsed = grantInputSchema.safeParse({
    ...values,
    target_unit: globalRole(String(values.wanted_role)) ? null : (values.target_unit ?? null),
  });
  if (!parsed.success) return { error: 'יש לבחור משתמש, תפקיד ויחידה מתאימה.', data: null };
  if (!mayGrant(parsed.data, scope))
    return { error: 'אין הרשאה להעניק תפקיד זה ביחידה שנבחרה.', data: null };
  return { error: '', data: parsed.data };
}
function mayGrant(input: GrantInput, scope: { admin: boolean; units: Unit[] }): boolean {
  if (globalRole(input.wanted_role)) return scope.admin && input.target_unit === null;
  return (
    input.target_unit !== null &&
    scope.units.some((u) => u.id === input.target_unit) &&
    (scope.admin || ['viewer', 'editor'].includes(input.wanted_role))
  );
}
export function noteError(decision: string, note: string): string {
  return decision === 'rejected' && note.trim().length < 2 ? 'יש לנמק דחייה בשני תווים לפחות.' : '';
}
