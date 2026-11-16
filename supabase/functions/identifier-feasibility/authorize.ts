// Only signed-in editors, unit managers and admins may run lookups. The
// decision is made by the database (public.identifier_lookup_authorize), with the caller's own
// token, so the function never trusts a role claimed by the browser.

export interface SupabaseEnv {
  readonly url: string;
  readonly anonKey: string;
}

export type Access = 'allowed' | 'unauthenticated' | 'forbidden' | 'limited' | 'unavailable';

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(\S+)$/iu.exec(header);
  return match?.[1] ?? null;
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
    const response = await fetcher(`${env.url}/rest/v1/rpc/identifier_lookup_authorize`, {
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
    if (response.status === 401) return 'unauthenticated';
    if (response.status === 403) return 'forbidden';
    if (response.status === 429) return 'limited';
    return response.ok ? 'allowed' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}
