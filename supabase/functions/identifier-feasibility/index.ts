import { parseNames, probe } from './lookup.ts';

declare const Deno: {
  serve: (handler: (request: Request) => Promise<Response>) => void;
};

export async function handle(request: Request, fetcher: typeof fetch = fetch): Promise<Response> {
  if (request.method !== 'POST')
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
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

if (typeof Deno !== 'undefined') Deno.serve((request) => handle(request));
