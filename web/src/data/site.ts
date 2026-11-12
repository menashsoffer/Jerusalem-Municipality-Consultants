import type { PublicSchema } from '../database.types.ts';
import { buildCatalog, type Supplier } from '../catalog-model.ts';
import { loadAccess, type Access } from './access.ts';
import { loadCatalog } from './catalog.ts';
import { DataClient } from './client.ts';

export const BASE = 'https://jzsvhjkiklfnogseelbe.supabase.co';
const PUBLIC_KEY = 'sb_publishable_XgkUnokIil-H5Qy4_VAN0A_VIUA2wwq';

type LegacyInsert = PublicSchema['legacy_suppliers']['Insert'];
type EventInsert = PublicSchema['activity_events']['Insert'];

export function data(token: string): DataClient {
  return new DataClient({ baseUrl: BASE, publicKey: PUBLIC_KEY, token });
}

function authHeaders(token?: string): HeadersInit {
  return {
    apikey: PUBLIC_KEY,
    Authorization: `Bearer ${token ?? PUBLIC_KEY}`,
    'Content-Type': 'application/json',
  };
}

export function currentUser(token: string): Promise<Response> {
  return fetch(`${BASE}/auth/v1/user`, { headers: authHeaders(token) });
}

export function exchangeCode(code: string, verifier: string): Promise<Response> {
  return fetch(`${BASE}/auth/v1/token?grant_type=pkce`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
  });
}

export function sendLink(email: string, redirect: string): Promise<Response> {
  return fetch(`${BASE}/auth/v1/otp?redirect_to=${encodeURIComponent(redirect)}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email, create_user: false }),
  });
}

let currentAccess: Access | null = null;

export async function access(token: string, userId: string): Promise<Access> {
  currentAccess = null;
  currentAccess = await loadAccess(data(token), userId);
  return currentAccess;
}

export function getAccess(): Access | null {
  return currentAccess;
}

export async function catalog(token: string): Promise<Supplier[]> {
  return buildCatalog(await loadCatalog(data(token)));
}

export function legacySuppliers(token: string): Promise<PublicSchema['legacy_suppliers']['Row'][]> {
  return data(token).list('legacy_suppliers');
}

export function addLegacy(token: string, row: LegacyInsert): Promise<void> {
  return data(token).insert('legacy_suppliers', row);
}

export function track(token: string, event: EventInsert): Promise<void> {
  return data(token).insert('activity_events', event);
}
