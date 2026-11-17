import { z, type ZodType } from 'zod';
z.config({ jitless: true });
export { z };
import type { PublicSchema } from '../database.types.ts';
import { SESSION_KEY, type Session } from './session.ts';
import { data, clearCatalog, loadSnapshot } from './site.ts';
import type { Access, Role } from './access.ts';
import { DataError } from './client.ts';

interface AdminRpc {
  decide_threshold_proposal: { proposal: string; approve: boolean };
  decide_profile: { target_user: string; decision: 'active' | 'rejected'; note: string | null };
  grant_role: { target_user: string; wanted_role: Role; target_unit: string | null };
  revoke_role: { grant_id: string };
  decide_identifier_candidate: { candidate: string; accept: boolean };
  decide_category_request: {
    request_id: string;
    decision: 'approved' | 'rejected' | 'linked';
    note: string;
    category_id: string | null;
  };
}
// Existing SQL RPCs not yet covered by the snapshot-only generator.
declare module '../database.types.ts' {
  interface PublicFunctions {
    decide_threshold_proposal: {
      Args: AdminRpc['decide_threshold_proposal'];
      Returns: string | null;
    };
    decide_profile: { Args: AdminRpc['decide_profile']; Returns: null };
    grant_role: { Args: AdminRpc['grant_role']; Returns: string };
    revoke_role: { Args: AdminRpc['revoke_role']; Returns: null };
    decide_identifier_candidate: {
      Args: AdminRpc['decide_identifier_candidate'];
      Returns: string | null;
    };
    decide_category_request: { Args: AdminRpc['decide_category_request']; Returns: string | null };
  }
}
const accessSchema = z.object({
  state: z.enum(['active', 'pending', 'rejected', 'blocked', 'unregistered']),
  member: z.boolean(),
  admin: z.boolean(),
  editor: z.boolean(),
  manager: z.boolean(),
  grants: z.array(
    z.object({
      role: z.enum(['viewer', 'editor', 'unit_manager', 'admin', 'auditor']),
      unitId: z.string().nullable(),
    }),
  ),
});
let session: Session | null = null;
let bootMessage = '';
export function setAdminSession(value: Session | null, message = ''): void {
  session = value;
  bootMessage = message;
}
export function getAdminSession(): Session | null {
  return session;
}
export function getBootMessage(): string {
  return bootMessage;
}
export function sessionToken(): string {
  if (!session || session.exp <= Date.now()) throw new DataError(401);
  return session.token;
}
export interface Identity {
  userId: string;
  access: Access;
}
async function clearExpired(error: unknown): Promise<void> {
  if (error instanceof DataError && error.status === 401) {
    session = null;
    await clearCatalog();
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(SESSION_KEY);
  }
}
async function validated<T>(request: () => Promise<unknown>, schema: ZodType<T>): Promise<T> {
  try {
    return schema.parse(await request());
  } catch (error) {
    await clearExpired(error);
    throw error;
  }
}
/** All roles come from the existing server access loader, never from JWT app_metadata. */
export async function identity(): Promise<Identity> {
  try {
    const token = sessionToken();
    const state = await loadSnapshot(token);
    const access = accessSchema.parse(state.access);
    return { userId: state.userId, access };
  } catch (error) {
    await clearExpired(error);
    throw error;
  }
}
export function permitted(access: Access, roles: readonly Role[]): boolean {
  return (
    access.state === 'active' && (access.admin || access.grants.some((g) => roles.includes(g.role)))
  );
}
export async function requireRoles(roles: readonly Role[]): Promise<Identity> {
  const who = await identity();
  if (!permitted(who.access, roles)) throw new DataError(403);
  return who;
}
export async function rpc<K extends keyof AdminRpc, T>(
  name: K,
  args: AdminRpc[K],
  schema: ZodType<T>,
): Promise<T> {
  return validated(() => data(sessionToken()).rpc(name, args), schema);
}
export async function rows<T>(
  table: keyof PublicSchema,
  filters: Record<string, string>,
  schema: ZodType<T>,
): Promise<T> {
  return validated(() => data(sessionToken()).list(table, filters), schema);
}
