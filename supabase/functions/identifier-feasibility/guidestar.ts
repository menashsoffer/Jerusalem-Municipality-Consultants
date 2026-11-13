const ROOT = 'https://www.guidestar.org.il/services/apexrest/api';
export interface Credentials {
  username: string;
  password: string;
}

async function session(credentials: Credentials, fetcher: typeof fetch): Promise<string> {
  const response = await fetcher(`${ROOT}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('GuideStar login failed');
  const body: unknown = await response.json();
  if (
    !body ||
    typeof body !== 'object' ||
    !('sessionId' in body) ||
    typeof body.sessionId !== 'string' ||
    !body.sessionId
  ) {
    throw new Error('GuideStar login failed');
  }
  return body.sessionId;
}

async function lookup(name: string, token: string, fetcher: typeof fetch): Promise<unknown> {
  if (/[;=<>]/u.test(name))
    return { name, available: false, reason: 'unsupported filter character' };
  const url = new URL(`${ROOT}/organizations`);
  url.searchParams.set('filter', `name=${name}`);
  const response = await fetcher(url, {
    headers: { Authorization: `Bearer ${token}` },
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) return { name, available: false, status: response.status };
  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) return { name, available: false, status: response.status };
  const matches: unknown[] = rows.filter((row: unknown) => {
    if (!row || typeof row !== 'object' || !('malkarType' in row)) return false;
    return row.malkarType === 'עמותה' || row.malkarType === 'חל״צ' || row.malkarType === 'חל"צ';
  });
  return { name, available: true, matches, linkHeaderPresent: response.headers.has('link') };
}

export async function probeGuideStar(
  names: string[],
  credentials: Credentials | null,
  fetcher: typeof fetch,
): Promise<unknown> {
  if (!credentials) return { available: false, reason: 'credentials not configured' };
  try {
    const token = await session(credentials, fetcher);
    const results: unknown[] = [];
    for (const name of names) results.push(await lookup(name, token, fetcher));
    return { available: true, results };
  } catch {
    return { available: false, reason: 'request failed' };
  }
}
