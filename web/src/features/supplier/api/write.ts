import { rpc, sessionToken, z } from '../../../data/rpc.ts';
import {
  loadSnapshot,
  renameSupplier,
  replaceContact,
  saveMembership,
  writeContext,
} from '../../../data/site.ts';
import type { WriteContext } from '../../../data/write-context.ts';

export interface SaveResult {
  message: string;
  error: string;
}
export const IDLE: SaveResult = { message: '', error: '' };

/** Runs a write, then refreshes the shared catalog so every screen sees the change. */
export async function saveAndRefresh(
  request: (token: string) => Promise<string>,
  refresh: () => Promise<void>,
  saved: string,
): Promise<SaveResult> {
  let token: string;
  try {
    token = sessionToken();
    await request(token);
  } catch (error) {
    return { message: '', error: error instanceof Error ? error.message : 'השמירה נכשלה.' };
  }
  try {
    await loadSnapshot(token);
    await refresh();
  } catch {
    return {
      message: 'השינוי נשמר, אך התצוגה לא התרעננה. יש לרענן לפני ניסיון נוסף.',
      error: '',
    };
  }
  return { message: saved, error: '' };
}

export const rename = (supplierId: string, name: string) => (token: string) =>
  renameSupplier(token, { supplier_id: supplierId, display_name: name });

export interface ContactChange {
  supplierId: string;
  contactId: string;
  kind: string;
  value: string;
}
export const contact = (change: ContactChange) => (token: string) =>
  replaceContact(token, {
    supplier_id: change.supplierId,
    contact_id: change.contactId,
    kind: change.kind,
    value: change.value,
  });

export interface StatusChange {
  active: boolean;
  reason?: string;
  source?: string;
  changedOn?: string;
}
/** Admin only; the database refuses anyone else and requires a reason and date to deactivate. */
export const status = (supplierId: string, change: StatusChange) => async () => {
  await rpc('set_supplier_status', { target: supplierId, change }, z.null());
  return '';
};

export const membership = (payload: Record<string, string>) => (token: string) =>
  saveMembership(token, payload);

export function loadWriteContext(): Promise<WriteContext> {
  return writeContext(sessionToken());
}
