import { DataError, type DataClient } from './client.ts';

export type Role = 'viewer' | 'editor' | 'unit_manager' | 'admin' | 'auditor';
export interface Grant {
  role: Role;
  unitId: string | null;
}
export interface Access {
  state: 'active' | 'pending' | 'rejected' | 'blocked' | 'unregistered';
  member: boolean;
  admin: boolean;
  editor: boolean;
  manager: boolean;
  grants: Grant[];
}

function parseFlags(value: unknown): Pick<Access, 'member' | 'admin' | 'editor' | 'manager'> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new DataError(0);
  const data = value as Record<string, unknown>;
  for (const key of ['member', 'admin', 'editor', 'manager']) {
    if (typeof data[key] !== 'boolean') throw new DataError(0);
  }
  return {
    member: data.member === true,
    admin: data.admin === true,
    editor: data.editor === true,
    manager: data.manager === true,
  };
}

function isRole(role: string): role is Role {
  return ['viewer', 'editor', 'unit_manager', 'admin', 'auditor'].includes(role);
}

export async function loadAccess(client: DataClient, userId: string): Promise<Access> {
  const [raw, profiles, grants] = await Promise.all([
    client.rpc('my_access'),
    client.list('profiles', { user_id: `eq.${userId}` }),
    client.list('role_grants', { user_id: `eq.${userId}` }),
  ]);
  const flags = parseFlags(raw);
  if (profiles.length > 1) throw new DataError(0);
  const status = profiles[0]?.status ?? 'unregistered';
  if (!['active', 'pending', 'rejected', 'blocked', 'unregistered'].includes(status)) {
    throw new DataError(0);
  }
  const now = Date.now();
  const active = grants.filter(
    (g) => g.revoked_at === null && (g.expires_at === null || Date.parse(g.expires_at) > now),
  );
  if (active.some((grant) => !isRole(grant.role))) throw new DataError(0);
  return {
    ...flags,
    state: status as Access['state'],
    grants: active.map((grant) => ({ role: grant.role as Role, unitId: grant.unit_id })),
  };
}

export function mayWriteUnit(access: Access, unitId: string): boolean {
  return (
    access.state === 'active' &&
    (access.admin ||
      access.grants.some(
        (grant) =>
          grant.unitId === unitId && (grant.role === 'editor' || grant.role === 'unit_manager'),
      ))
  );
}
