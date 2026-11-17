import type { PublicSchema } from '../database.types.ts';
import { supplierDetail, type SupplierDetail } from './supplier-detail.ts';
import { loadWriteContext, writableVersions, type WriteContext } from './write-context.ts';
import { DataClient, REQUEST_TIMEOUT_MS } from './client.ts';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './environment.ts';
import type { EventRequest } from '../app/tracker.ts';
import { IndexedCatalogCache } from './catalog-cache.ts';
import { SnapshotLoader, tokenUserId, type CatalogState } from './snapshot.ts';

export const BASE = SUPABASE_URL;
const PUBLIC_KEY = SUPABASE_PUBLISHABLE_KEY;

type EventInsert = PublicSchema['activity_events']['Insert'];

export function data(token: string): DataClient {
  return new DataClient({
    baseUrl: BASE,
    publicKey: PUBLIC_KEY,
    token,
    onUnauthorized: () => (token === currentToken ? clearCatalog() : Promise.resolve()),
  });
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

const loader = new SnapshotLoader(new IndexedCatalogCache(BASE));
let currentToken: string | null = null;
type Listener = (state: CatalogState | null) => void;
const listeners = new Set<Listener>();

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function publishState(state: CatalogState | null): void {
  for (const listener of listeners) listener(state);
}

export async function loadSnapshot(
  token: string,
  publish: (state: CatalogState) => void = () => undefined,
  onRequest: () => void = () => undefined,
): Promise<CatalogState> {
  if (currentToken && currentToken !== token) await loader.clear();
  currentToken = token;
  return loader.load(data(token), token, {
    publish: (state) => {
      publishState(state);
      publish(state);
    },
    onRequest,
  });
}

/** `notify: false` clears silently, for a sign-out that reloads the page right after. */
export async function clearCatalog(userId?: string, notify = true): Promise<void> {
  const id = userId ?? tokenUserId(currentToken ?? '') ?? undefined;
  currentToken = null;
  const clearing = loader.clear(id);
  if (notify) publishState(null);
  await clearing;
}

/** A card opened while the cached catalog is revalidating waits for server access. */
async function confirmed(token: string) {
  const state = await loader.settled();
  if (!state?.access || !state.catalog || currentToken !== token)
    throw new Error('יש להתחבר מחדש.');
  return { ...state, access: state.access, catalog: state.catalog };
}

/** Stable object reference between publications, for React external-store readers. */
export function getCatalogState(): CatalogState | null {
  return loader.state;
}

export function getAccess() {
  return loader.state?.access ?? null;
}

export async function catalog(token: string) {
  return (await loadSnapshot(token)).suppliers;
}

export async function detail(token: string, supplierId: string): Promise<SupplierDetail> {
  const state = await confirmed(token);
  return supplierDetail(data(token), state.catalog, supplierId);
}

export function canAddSupplier(): boolean {
  const state = loader.state;
  return (
    !!state?.access && !!state.catalog && writableVersions(state.catalog, state.access).length > 0
  );
}

export async function writeContext(token: string): Promise<WriteContext> {
  const state = await confirmed(token);
  return loadWriteContext(data(token), state.catalog, state.access);
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
