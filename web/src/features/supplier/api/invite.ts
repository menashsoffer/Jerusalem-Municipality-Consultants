import { z, rpc } from '../../../data/rpc.ts';
import { errorText } from '../../../data/errors.ts';

/** The supplier area's address, sent to the supplier by hand: version 1 sends no email. */
export function areaLink(location: Pick<Location, 'origin' | 'pathname'> = window.location) {
  return `${location.origin}${location.pathname}#/supplier-area`;
}

/** Invites the person behind one of the supplier's own emails (supplier-portal spec 5.1). */
export async function inviteToArea(supplierId: string, email: string): Promise<string> {
  try {
    await rpc('invite_supplier_account', { supplier_id: supplierId, email }, z.string());
    return '';
  } catch (error) {
    return errorText(error);
  }
}
