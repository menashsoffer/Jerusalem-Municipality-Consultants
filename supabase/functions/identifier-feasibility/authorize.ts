// Only signed-in editors, unit managers and admins may run lookups. The
// decision is made by the database (public.my_access), with the caller's own
// token, so the function never trusts a role claimed by the browser.

export interface SupabaseEnv {
  readonly url: string;
  readonly anonKey: string;
}

export type Access = 'allowed' | 'unauthenticated' | 'forbidden' | 'unavailable';

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(\S+)$/iu.exec(header);
  return match?.[1] ?? null;
}

function canLookUp(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const access = body as Record<string, unknown>;
  return access.admin === true || access.editor === true;
}

export async function authorize(
  request: Request,
  env: SupabaseEnv | null,
  fetcher: typeof fetch,
): Promise<Access> {
  const token = bearerToken(request);
  if (!token) return 'unauthenticated';
  if (!env) return 'unavailable';
  try {
    const response = await fetcher(`${env.url}/rest/v1/rpc/my_access`, {
      method: 'POST',
      headers: {
        apikey: env.anonKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
    if (response.status === 401 || response.status === 403) return 'unauthenticated';
    if (!response.ok) return 'unavailable';
    return canLookUp(await response.json()) ? 'allowed' : 'forbidden';
  } catch {
    return 'unavailable';
  }
}
