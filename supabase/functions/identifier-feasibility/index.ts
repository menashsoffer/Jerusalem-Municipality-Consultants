import { authorize, type Access, type SupabaseEnv } from './authorize.ts';
import { parseNames, probe } from './lookup.ts';

declare const Deno: {
  serve: (handler: (request: Request) => Promise<Response>) => void;
  env: { get: (name: string) => string | undefined };
};

const DENIED: Record<Exclude<Access, 'allowed'>, [string, number]> = {
  unauthenticated: ['Sign in required', 401],
  forbidden: ['Not authorized', 403],
  unavailable: ['Authorization check unavailable', 503],
};

export async function handle(
  request: Request,
  env: SupabaseEnv | null,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  if (request.method !== 'POST')
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  const access = await authorize(request, env, fetcher);
  if (access !== 'allowed') {
    const [error, status] = DENIED[access];
    return Response.json({ error }, { status });
  }
  let names: string[];
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || !('names' in body)) throw new Error('Invalid input');
    names = parseNames(body.names);
  } catch {
    return Response.json({ error: 'Invalid supplier names' }, { status: 400 });
  }
  return Response.json(await probe(names, fetcher));
}

function supabaseEnv(): SupabaseEnv | null {
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  return url && anonKey ? { url, anonKey } : null;
}

if (typeof Deno !== 'undefined') Deno.serve((request) => handle(request, supabaseEnv()));
