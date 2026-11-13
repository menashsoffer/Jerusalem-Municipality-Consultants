import type { PublicSchema } from '../database.types.ts';
import { buildCatalog, type Supplier } from '../catalog-model.ts';
import { loadAccess, type Access } from './access.ts';
import { loadCatalog, type CatalogData } from './catalog.ts';
import { supplierDetail, type SupplierDetail } from './supplier-detail.ts';
import { loadWriteContext, writableVersions, type WriteContext } from './write-context.ts';
import { DataClient } from './client.ts';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './environment.ts';

export const BASE = SUPABASE_URL;
const PUBLIC_KEY = SUPABASE_PUBLISHABLE_KEY;

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
let currentCatalog: CatalogData | null = null;
let currentToken: string | null = null;

export async function access(token: string, userId: string): Promise<Access> {
  currentAccess = null;
  currentCatalog = null;
  currentToken = null;
  currentAccess = await loadAccess(data(token), userId);
  return currentAccess;
}

export function getAccess(): Access | null {
  return currentAccess;
}

export async function catalog(token: string): Promise<Supplier[]> {
  currentCatalog = await loadCatalog(data(token));
  currentToken = token;
  return buildCatalog(currentCatalog);
}

export async function detail(token: string, supplierId: string): Promise<SupplierDetail> {
  if (!currentAccess || !currentCatalog || currentToken !== token)
    throw new Error('יש להתחבר מחדש.');
  return supplierDetail(data(token), currentCatalog, { supplierId, access: currentAccess });
}

export function canAddSupplier(): boolean {
  return (
    !!currentAccess &&
    !!currentCatalog &&
    writableVersions(currentCatalog, currentAccess).length > 0
  );
}

export async function writeContext(token: string): Promise<WriteContext> {
  if (!currentAccess || !currentCatalog || currentToken !== token)
    throw new Error('יש להתחבר מחדש.');
  return loadWriteContext(data(token), currentCatalog, currentAccess);
}

export function saveMembership(token: string, payload: Record<string, string>): Promise<string> {
  return data(token).supplierWrite('save_supplier_membership', payload);
}

export function renameSupplier(token: string, payload: Record<string, string>): Promise<string> {
  return data(token).supplierWrite('rename_supplier', payload);
}

export function replaceContact(token: string, payload: Record<string, string>): Promise<string> {
  return data(token).supplierWrite('replace_supplier_contact', payload);
}

export function track(token: string, event: EventInsert): Promise<void> {
  return data(token).insert('activity_events', event);
}
