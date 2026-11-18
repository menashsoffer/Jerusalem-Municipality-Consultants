import { freshToken, recoverSession } from '../../../data/rpc.ts';
import { DataError, REQUEST_TIMEOUT_MS } from '../../../data/client.ts';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../../../data/environment.ts';
import { checkInputSchema, resultSchema, type CheckInput } from '../model/result.ts';
const MESSAGES: Record<number, string> = {
  404: 'הבקשה אינה זמינה לבדיקה.',
  422: 'לא נמצאו ספים בתוקף לתאריך שנבחר.',
  429: 'בוצעו יותר מדי בדיקות. יש לנסות שוב מאוחר יותר.',
};
class CheckError extends DataError {
  constructor(status: number) {
    super(status);
    this.message = MESSAGES[status] ?? this.message;
  }
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
  } catch {
    throw new DataError(0);
  }
  // Renews the session for the next try, or signs out when it cannot be renewed.
  if (response.status === 401) await recoverSession(token).catch(() => null);
  if (!response.ok) throw new CheckError(response.status);
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
