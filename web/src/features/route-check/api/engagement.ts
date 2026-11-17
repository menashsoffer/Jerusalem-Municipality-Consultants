import type { LoaderFunctionArgs } from 'react-router';
import { z, identity, rpc, freshToken } from '../../../data/rpc.ts';
import { DataError } from '../../../data/client.ts';
import { mayWriteUnit } from '../../../data/access.ts';
import { detail, getCatalogState } from '../../../data/site.ts';
import { israelToday } from '../../../lib/dates.ts';
import { cleanIds, replaceShortlist, shortlistIds } from '../../../lib/shortlist.ts';
import { pickedSupplier, type PickedSupplier } from '../model/engagement.ts';
import type { Draft } from '../model/result.ts';

const lastSchema = z.array(z.object({ supplier_id: z.string(), last_on: z.iso.date() }));

/** A shared link names its suppliers; otherwise the list picked in this tab is used. */
function pickedIds(url: URL): string[] {
  const shared = url.searchParams.get('suppliers');
  if (shared === null) return [...shortlistIds()];
  const ids = cleanIds(shared.split(','));
  replaceShortlist(ids);
  return ids;
}

async function loadSuppliers(ids: string[]): Promise<PickedSupplier[]> {
  if (!ids.length) return [];
  const token = await freshToken();
  const [details, last] = await Promise.all([
    Promise.all(ids.map((id) => detail(token, id).catch(() => null))),
    rpc('last_approaches', { suppliers: ids }, lastSchema),
  ]);
  const lastOn = new Map(last.map((row) => [row.supplier_id, row.last_on]));
  return details
    .filter((d) => d !== null)
    .map((d) => pickedSupplier(d, lastOn.get(d.supplier.id) ?? null));
}

export async function loadEngagement({ request }: LoaderFunctionArgs) {
  const who = await identity();
  if (who.access.state !== 'active' || !who.access.member) throw new DataError(403);
  const suppliers = await loadSuppliers(pickedIds(new URL(request.url)));
  const units = (getCatalogState()?.catalog?.units ?? []).filter((unit) =>
    mayWriteUnit(who.access, unit.id),
  );
  return { suppliers, units, today: israelToday() };
}
export type EngagementData = Awaited<ReturnType<typeof loadEngagement>>;

export interface SavedDraft extends Draft {
  unit_id: string;
  subject: string;
}

export function saveRequest(draft: SavedDraft): Promise<string> {
  return rpc('create_engagement_request', { draft }, z.string());
}

export function recordApproaches(request: string, suppliers: string[]): Promise<number> {
  return rpc(
    'record_supplier_approaches',
    { request, suppliers, channel: 'email' },
    z.number().int(),
  );
}
