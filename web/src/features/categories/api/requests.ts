import { z, rows, rpc, requireRoles } from '../../../data/rpc.ts';
import { requestSchema, parseDecision } from '../model/decision.ts';
import { DataError } from '../../../data/client.ts';
export async function loadRequests() {
  const who = await requireRoles(['admin']);
  const [requests, categories] = await Promise.all([
    rows('category_requests', { status: 'eq.pending' }, z.array(requestSchema)),
    rows(
      'categories',
      { active: 'eq.true' },
      z.array(z.object({ id: z.string(), name: z.string() })),
    ),
  ]);
  return { requests, categories, userId: who.userId };
}
export async function decideRequest(id: string, form: FormData, refresh: () => Promise<void>) {
  const decision = parseDecision(form);
  if ('error' in decision) return { error: decision.error, committed: false };
  try {
    await rpc('decide_category_request', { request_id: id, ...decision }, z.string().nullable());
  } catch (error) {
    // 404: another administrator already decided the request.
    if (error instanceof DataError && error.status === 404) {
      await refresh().catch(() => undefined);
      return { error: 'הבקשה כבר טופלה. הרשימה רועננה.', committed: false };
    }
    return {
      error: error instanceof DataError ? error.message : 'לא ניתן לשמור את ההחלטה.',
      committed: false,
    };
  }
  try {
    await refresh();
  } catch {
    return { error: 'ההחלטה נשמרה. יש לרענן את הרשימה לפני פעולה נוספת.', committed: true };
  }
  return { error: '', committed: true };
}
