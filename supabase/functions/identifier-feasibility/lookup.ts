import { probeGuideStar, type Credentials } from './guidestar.ts';

const RESOURCE = 'f004176c-b85f-4542-8901-7b3176f9a054';
const ENDPOINT = 'https://data.gov.il/api/3/action/datastore_search';
const MAX_NAMES = 10;
const MAX_NAME_LENGTH = 200;
const MAX_RESULTS = 5;

export function parseNames(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_NAMES) {
    throw new Error('Expected one to ten supplier names');
  }
  if (
    value.some(
      (name: unknown) => typeof name !== 'string' || !name.trim() || name.length > MAX_NAME_LENGTH,
    )
  ) {
    throw new Error('Invalid supplier name');
  }
  return (value as string[]).map((name) => name.trim());
}

export async function lookupCompany(name: string, fetcher: typeof fetch): Promise<unknown> {
  const url = new URL(ENDPOINT);
  url.search = new URLSearchParams({
    resource_id: RESOURCE,
    q: name,
    limit: String(MAX_RESULTS),
  }).toString();
  try {
    const response = await fetcher(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) return { name, available: false, status: response.status };
    const body: unknown = await response.json();
    if (
      !body ||
      typeof body !== 'object' ||
      !('success' in body) ||
      body.success !== true ||
      !('result' in body)
    ) {
      return { name, available: false, status: response.status };
    }
    return { name, available: true, data: body.result };
  } catch {
    return { name, available: false, status: null };
  }
}

export async function probe(
  names: string[],
  fetcher: typeof fetch,
  credentials: Credentials | null = null,
): Promise<unknown> {
  const companies: unknown[] = [];
  for (const name of names) companies.push(await lookupCompany(name, fetcher));
  return { companies, guidestar: await probeGuideStar(names, credentials, fetcher) };
}
