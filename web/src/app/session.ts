/* Browser sign-in state: the session token, the PKCE verifier and errors returned by Supabase. */
export const SESSION_KEY = 'consultants-session-v1';
export const PKCE_KEY = 'consultants-pkce-v1';

export interface Session {
  token: string;
  exp: number;
}
export interface BrowserContext {
  location: Pick<Location, 'href' | 'pathname' | 'search' | 'hash'>;
  history: Pick<History, 'replaceState'>;
  storage: Storage;
}
type Exchange = (code: string, verifier: string) => Promise<Response>;

const EXPIRED_CODES = new Set(['bad_oauth_state', 'flow_state_expired', 'otp_expired']);
export const EXPIRED_MESSAGE = 'תוקף ניסיון ההתחברות פג. יש להתחיל התחברות חדשה.';
export const FAILED_MESSAGE = 'ההתחברות לא הושלמה. יש להתחיל מחדש או לפנות למנהל המערכת.';

function replaceUrl(ctx: BrowserContext, url: URL): void {
  ctx.history.replaceState(null, '', url.pathname + url.search + url.hash);
}

/** Removes an authentication error from the address and returns a message to show. */
export function takeAuthError(ctx: BrowserContext): string {
  const url = new URL(ctx.location.href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const error = url.searchParams.get('error') ?? fragment.get('error');
  const code = url.searchParams.get('error_code') ?? fragment.get('error_code') ?? '';
  if (!error && !code) return '';
  for (const key of ['error', 'error_code', 'error_description']) {
    url.searchParams.delete(key);
    fragment.delete(key);
  }
  url.hash = fragment.toString();
  replaceUrl(ctx, url);
  ctx.storage.removeItem(PKCE_KEY);
  return EXPIRED_CODES.has(code) ? EXPIRED_MESSAGE : FAILED_MESSAGE;
}

export function storeSession(storage: Storage, token: string, expiresIn: number): void {
  const session: Session = { token, exp: Date.now() + expiresIn * 1000 };
  storage.setItem(SESSION_KEY, JSON.stringify(session));
}

function parseSession(raw: string | null): Session | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (value === null || typeof value !== 'object') return null;
    const { token, exp } = value as Record<string, unknown>;
    if (typeof token !== 'string' || typeof exp !== 'number') return null;
    return exp > Date.now() ? { token, exp } : null;
  } catch {
    return null;
  }
}

/** Keeps a token from a magic-link redirect, then returns the stored session if still valid. */
export function takeSession(ctx: BrowserContext): Session | null {
  const params = new URLSearchParams(ctx.location.hash.slice(1));
  const token = params.get('access_token');
  if (token) {
    storeSession(ctx.storage, token, Number(params.get('expires_in')) || 3600);
    ctx.history.replaceState(null, '', ctx.location.pathname + ctx.location.search);
  }
  return parseSession(ctx.storage.getItem(SESSION_KEY));
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Creates a PKCE verifier, keeps it for the redirect back, and returns the authorize URL. */
export async function googleAuthorizeUrl(
  ctx: BrowserContext,
  base: string,
  redirect: string,
): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const verifier = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  ctx.storage.setItem(PKCE_KEY, verifier);
  const params = new URLSearchParams({
    provider: 'google',
    redirect_to: redirect,
    code_challenge: base64Url(new Uint8Array(hash)),
    code_challenge_method: 's256',
  });
  return `${base}/auth/v1/authorize?${params}`;
}

/** Trades an OAuth code in the address for a session. Does nothing without a code. */
export async function exchangeGoogleCode(ctx: BrowserContext, exchange: Exchange): Promise<void> {
  const url = new URL(ctx.location.href);
  const code = url.searchParams.get('code');
  if (!code) return;
  url.searchParams.delete('code');
  replaceUrl(ctx, url);
  const verifier = ctx.storage.getItem(PKCE_KEY);
  ctx.storage.removeItem(PKCE_KEY);
  if (!verifier) throw new Error('missing verifier');
  const response = await exchange(code, verifier);
  if (!response.ok) throw new Error('exchange failed');
  const data: unknown = await response.json();
  const { access_token: token, expires_in: expiresIn } = (data ?? {}) as Record<string, unknown>;
  if (typeof token !== 'string' || !token || !Number(expiresIn)) {
    throw new Error('invalid session');
  }
  storeSession(ctx.storage, token, Number(expiresIn));
}
