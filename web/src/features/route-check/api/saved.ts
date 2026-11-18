// Saved engagement requests with the state of their latest route check (screens-spec 2.ב).
import { z, rows, permitted, type Identity } from '../../../data/rpc.ts';

const requestSchema = z.object({
  id: z.string(),
  unit_id: z.string(),
  subject: z.string(),
  estimated_value: z.number().nonnegative(),
  value_includes_vat: z.boolean(),
  requested_exemption: z.string().nullable(),
  created_at: z.string(),
});
const checkSchema = z.object({
  request_id: z.string(),
  status: z.enum(['ok', 'needs_review', 'blocked']).catch('needs_review'),
});

export type SavedRequest = z.infer<typeof requestSchema> & {
  lastStatus: 'ok' | 'needs_review' | 'blocked' | null;
};
/** The roles that may save requests and check them again; the database enforces it too. */
export const SAVED_ROLES = ['editor', 'unit_manager'] as const;

/** Newest first; null for a user who cannot see saved requests. */
export async function loadSaved(who: Identity): Promise<SavedRequest[] | null> {
  if (!permitted(who.access, SAVED_ROLES)) return null;
  const requests = await rows(
    'engagement_requests',
    { status: 'not.in.(cancelled,rejected,contracted)', order: 'created_at.desc' },
    z.array(requestSchema),
  );
  if (!requests.length) return [];
  const checks = await rows(
    'route_checks',
    { request_id: `in.(${requests.map((r) => r.id).join(',')})`, order: 'created_at.desc' },
    z.array(checkSchema),
  );
  const latest = new Map<string, SavedRequest['lastStatus']>();
  for (const check of checks)
    if (!latest.has(check.request_id)) latest.set(check.request_id, check.status);
  return requests.map((request) => ({ ...request, lastStatus: latest.get(request.id) ?? null }));
}
