import type { PublicSchema } from '../database.types.ts';
import type { Supplier } from '../catalog-model.ts';
import type { Access } from './access.ts';
import type { CatalogData } from './catalog.ts';
import { CatalogStore, cacheUserId } from './catalog-store.ts';
import { catalogCache } from './catalog-cache.ts';
import { supplierDetail, type SupplierDetail } from './supplier-detail.ts';
import { loadWriteContext, writableVersions, type WriteContext } from './write-context.ts';
import { DataClient, REQUEST_TIMEOUT_MS } from './client.ts';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './environment.ts';
import type { EventRequest } from '../app/tracker.ts';

export const BASE = SUPABASE_URL;
const PUBLIC_KEY = SUPABASE_PUBLISHABLE_KEY;

type EventInsert = PublicSchema['activity_events']['Insert'];

export function data(token: string): DataClient {
  return new DataClient({ baseUrl: BASE, publicKey: PUBLIC_KEY, token });
}

function authHeaders(token?: string): Record<string, string> {
  return {
    apikey: PUBLIC_KEY,
    Authorization: `Bearer ${token ?? PUBLIC_KEY}`,
    'Content-Type': 'application/json',
  };
}

export function exchangeCode(code: string, verifier: string): Promise<Response> {
  return fetch(`${BASE}/auth/v1/token?grant_type=pkce`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

export function sendLink(email: string, redirect: string): Promise<Response> {
  return fetch(`${BASE}/auth/v1/otp?redirect_to=${encodeURIComponent(redirect)}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email, create_user: false }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

export const catalogStore = new CatalogStore(
  catalogCache(typeof indexedDB === 'undefined' ? undefined : indexedDB),
);
let currentAccess: Access | null = null;
let currentCatalog: CatalogData | null = null;
let currentToken: string | null = null;

export async function openCatalog(token: string) {
  if (currentToken !== token) {
    currentAccess = null;
    currentCatalog = null;
  }
  currentToken = token;
  const state = await catalogStore.load(
    (known_version) => data(token).rpc('catalog_snapshot', { known_version }),
    cacheUserId(token),
  );
  if (currentToken === token) {
    currentAccess = state.access;
    currentCatalog = state.catalog;
  }
  return state;
}

export async function clearCatalog(): Promise<void> {
  currentAccess = null;
  currentCatalog = null;
  currentToken = null;
  await catalogStore.clear();
}
export function getAccess(): Access | null {
  return currentAccess;
}
export async function catalog(token: string): Promise<Supplier[]> {
  return (await openCatalog(token)).suppliers;
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

/** The request that stores a batch of usage events; the tracker decides when it is sent. */
export function eventRequest(token: string, events: EventInsert[]): EventRequest {
  return {
    url: `${BASE}/rest/v1/activity_events`,
    init: {
      method: 'POST',
      headers: { ...authHeaders(token), Prefer: 'return=minimal' },
      body: JSON.stringify(events),
    },
  };
}
