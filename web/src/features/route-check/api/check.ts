import { z, rows, requireRoles, sessionToken, setAdminSession } from '../../../data/rpc.ts';
import { DataError, REQUEST_TIMEOUT_MS } from '../../../data/client.ts';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../../../data/environment.ts';
import { clearCatalog } from '../../../data/site.ts';
import { SESSION_KEY } from '../../../data/session.ts';
import { checkInputSchema, resultSchema, type CheckInput } from '../model/result.ts';
const requestSchema = z.object({
  id: z.string(),
  unit_id: z.string(),
  subject: z.string(),
  estimated_value: z.number().nonnegative(),
  value_includes_vat: z.boolean(),
  requested_exemption: z.string().nullable(),
});
export type EngagementRequest = z.infer<typeof requestSchema>;
export async function loadRequests() {
  await requireRoles(['editor', 'unit_manager', 'admin']);
  const [requests, units] = await Promise.all([
    rows(
      'engagement_requests',
      { status: 'not.in.(cancelled,rejected,contracted)' },
      z.array(requestSchema),
    ),
    rows('org_units', {}, z.array(z.object({ id: z.string(), name: z.string() }))),
  ]);
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return { requests, units, today };
}
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
  const token = sessionToken();
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
  if (response.status === 401) {
    setAdminSession(null);
    await clearCatalog().catch(() => undefined);
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(SESSION_KEY);
  }
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
