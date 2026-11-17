import { z, type ZodType } from 'zod';
z.config({ jitless: true });
export { z };
import type { PublicSchema } from '../database.types.ts';
import type { Session } from './session.ts';
import { data, loadSnapshot, refreshGrant } from './site.ts';
import { SessionKeeper } from './auth-session.ts';
import { MemoryStorage } from './memory-storage.ts';
import type { Access, Role } from './access.ts';
import { DataError } from './client.ts';

interface AdminRpc {
  decide_threshold_proposal: { proposal: string; approve: boolean };
  decide_profile: { target_user: string; decision: 'active' | 'rejected'; note: string | null };
  grant_role: { target_user: string; wanted_role: Role; target_unit: string | null };
  revoke_role: { grant_id: string };
  decide_identifier_candidate: { candidate: string; accept: boolean };
  set_supplier_status: {
    target: string;
    change: { active: boolean; reason?: string; source?: string; changedOn?: string };
  };
  create_engagement_request: {
    draft: {
      unit_id: string;
      subject: string;
      estimated_value: number;
      value_includes_vat: boolean;
      requested_exemption: string | null;
    };
  };
  record_supplier_approaches: { request: string; suppliers: string[]; channel: 'email' };
  last_approaches: { suppliers: string[] };
  load_control: Record<string, never>;
  addresses_to_check: Record<string, never>;
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
    set_supplier_status: { Args: AdminRpc['set_supplier_status']; Returns: null };
    create_engagement_request: { Args: AdminRpc['create_engagement_request']; Returns: string };
    record_supplier_approaches: { Args: AdminRpc['record_supplier_approaches']; Returns: number };
    load_control: { Args: AdminRpc['load_control']; Returns: unknown };
    addresses_to_check: { Args: AdminRpc['addresses_to_check']; Returns: unknown };
    last_approaches: {
      Args: AdminRpc['last_approaches'];
      Returns: { supplier_id: string; last_on: string }[];
    };
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
let keeper = new SessionKeeper({ storage: new MemoryStorage(), refresh: refreshGrant });
let bootMessage = '';
/** The browser entry installs a keeper backed by localStorage before the router starts. */
export function installKeeper(value: SessionKeeper): void {
  keeper = value;
}
export function getKeeper(): SessionKeeper {
  return keeper;
}
export function setAdminSession(value: Session | null, message = ''): void {
  keeper.adopt(value);
  bootMessage = message;
}
export function getAdminSession(): Session | null {
  return keeper.current();
}
export function getBootMessage(): string {
  return bootMessage;
}
/** The current access token, without renewing it; loaders that cannot wait use this. */
export function sessionToken(): string {
  const session = keeper.current();
  if (!session || session.exp <= Date.now()) throw new DataError(401);
  return session.token;
}
/** An access token with time left, renewed first when it is about to expire. */
export async function freshToken(): Promise<string> {
  const session = await keeper.fresh();
  if (!session) throw new DataError(401);
  return session.token;
}
/** After a 401: a renewed token, or null once the session cannot be renewed. */
export async function recoverSession(failedToken: string): Promise<string | null> {
  const session = await keeper.recover(failedToken);
  return session?.token ?? null;
}
export interface Identity {
  userId: string;
  access: Access;
}
function unauthorized(error: unknown): boolean {
  return error instanceof DataError && error.status === 401;
}
/** Runs a request with a fresh token, and once more with a renewed token after a 401. */
async function authorized<T>(request: (token: string) => Promise<T>): Promise<T> {
  const token = await freshToken();
  try {
    return await request(token);
  } catch (error) {
    if (!unauthorized(error)) throw error;
    const renewed = await recoverSession(token);
    if (!renewed) throw error;
    return request(renewed);
  }
}
async function validated<T>(
  request: (token: string) => Promise<unknown>,
  schema: ZodType<T>,
): Promise<T> {
  return schema.parse(await authorized(request));
}
/** All roles come from the existing server access loader, never from JWT app_metadata. */
export async function identity(): Promise<Identity> {
  const state = await authorized((token) => loadSnapshot(token));
  return { userId: state.userId, access: accessSchema.parse(state.access) };
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
  return validated((token) => data(token).rpc(name, args), schema);
}
export async function rows<T>(
  table: keyof PublicSchema,
  filters: Record<string, string>,
  schema: ZodType<T>,
): Promise<T> {
  return validated((token) => data(token).list(table, filters), schema);
}
