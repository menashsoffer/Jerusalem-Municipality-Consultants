import { z, rows, rpc, requireRoles } from '../../../data/rpc.ts';
const role = z.enum(['viewer', 'editor', 'unit_manager', 'admin', 'auditor']);
export const profileSchema = z.object({
  user_id: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  email: z.string(),
  job_title: z.string(),
  unit_id: z.string().nullable(),
  purpose: z.string(),
  status: z.enum(['active', 'pending', 'rejected', 'blocked']),
});
export const grantSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  role,
  unit_id: z.string().nullable(),
  expires_at: z.string().nullable(),
  revoked_at: z.string().nullable(),
});
const unitSchema = z.object({ id: z.string(), name: z.string() });
export type Profile = z.infer<typeof profileSchema>;
export type GrantRow = z.infer<typeof grantSchema>;
export type Unit = z.infer<typeof unitSchema>;
export async function loadUsers() {
  const who = await requireRoles(['admin', 'unit_manager']);
  const [profiles, grants, units] = await Promise.all([
    rows('profiles', {}, z.array(profileSchema)),
    rows('role_grants', { revoked_at: 'is.null' }, z.array(grantSchema)),
    rows('org_units', { active: 'eq.true' }, z.array(unitSchema)),
  ]);
  return { who, profiles, grants, units, now: Date.now() };
}
export async function reviewProfile(
  userId: string,
  decision: 'active' | 'rejected',
  note: string,
): Promise<void> {
  await rpc('decide_profile', { target_user: userId, decision, note: note || null }, z.null());
}
export async function removeGrant(id: string): Promise<void> {
  await rpc('revoke_role', { grant_id: id }, z.null());
}
export const grantInputSchema = z.object({
  target_user: z.string().min(1),
  wanted_role: role,
  target_unit: z.string().nullable(),
});
export type GrantInput = z.infer<typeof grantInputSchema>;
export async function addGrant(input: GrantInput): Promise<void> {
  await rpc('grant_role', input, z.string());
}
