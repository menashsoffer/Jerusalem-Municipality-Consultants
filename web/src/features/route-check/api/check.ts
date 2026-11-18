import { freshToken, recoverSession } from '../../../data/rpc.ts';
import { DataError, REQUEST_TIMEOUT_MS, unanswered } from '../../../data/client.ts';
import { kindOfStatus, type FailureKind } from '../../../lib/errors/failure.ts';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../../../data/environment.ts';
import { checkInputSchema, resultSchema, type CheckInput } from '../model/result.ts';
/** Messages the route check owns, for answers that mean more here than in general. */
const OWN: Partial<Record<number, string>> = {
  404: 'הבקשה כבר לא קיימת או שאינה ביחידה שלך. רעננו את רשימת הבקשות השמורות.',
  422: 'אין סף מכרז מאושר לתאריך הזה. בחרו תאריך אחר, או בקשו ממנהל מערכת לאשר את הסף החודשי.',
};
/** The function says "Database unavailable" when it could not reach the database. */
const DATABASE_DOWN = 'Database unavailable';

class CheckError extends DataError {
  constructor(status: number, message: string) {
    super(status, null, kindOf(status, message));
    this.message = OWN[status] ?? this.message;
  }
}

function kindOf(status: number, message: string): FailureKind {
  if (status === 422) return 'reason';
  if (status === 502 && message !== DATABASE_DOWN) return 'system';
  return kindOfStatus(status);
}

async function failed(response: Response): Promise<CheckError> {
  let message = '';
  try {
    const body = (await response.json()) as { error?: unknown };
    message = typeof body.error === 'string' ? body.error : '';
  } catch {
    /* An empty or broken body keeps the status alone. */
  }
  return new CheckError(response.status, message);
}

export async function checkRoute(input: CheckInput, fetcher: typeof fetch = fetch) {
  const body = checkInputSchema.parse(input);
  const token = await freshToken();
  let response: Response;
  try {
    response = await fetcher(`${SUPABASE_URL}/functions/v1/route-check`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw unanswered(error);
  }
  // Renews the session for the next try, or signs out when it cannot be renewed.
  if (response.status === 401) await recoverSession(token).catch(() => null);
  if (!response.ok) throw await failed(response);
  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    throw new DataError(0);
  }
  const result = resultSchema.safeParse(raw);
  if (!result.success) throw new DataError(0);
  return result.data;
}
