import { use, useSyncExternalStore } from 'react';
import { getCatalogState, subscribe, detail } from './site.ts';
import type { SupplierDetail } from './supplier-detail.ts';
import { tokenUserId } from './snapshot.ts';
import { DataError } from './client.ts';
const serverSnapshot = () => null;
/** The existing catalog remains the single store; React keeps no copy of it. */
export function useCatalogSnapshot() {
  return useSyncExternalStore(subscribe, getCatalogState, serverSnapshot);
}
export interface SupplierDetailResource {
  readonly supplierId: string;
  readonly userId: string | null;
  readonly promise: Promise<SupplierDetail>;
}
/** Create in a route loader or event, before rendering. Each visit rechecks server access. */
export function createSupplierDetailResource(
  token: string,
  supplierId: string,
): SupplierDetailResource {
  const promise = detail(token, supplierId);
  // A lazy screen may mount after the request rejects; keep it handled until React reads it.
  void promise.catch(() => undefined);
  return { supplierId, userId: tokenUserId(token), promise };
}
/** Suspend on the loader's stable promise; the route error boundary handles failures. */
export function useSupplierDetail(resource: SupplierDetailResource): SupplierDetail {
  const state = useCatalogSnapshot();
  if (state?.userId !== resource.userId) throw new DataError(401);
  const result = use(resource.promise);
  if (!state.catalog || !state.access?.member || state.access.state !== 'active')
    throw new DataError(403);
  return result;
}
