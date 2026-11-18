import { z, rows, rpc, requireRoles } from '../../../data/rpc.ts';
import { DataError } from '../../../data/client.ts';
const amount = z.number().positive();
export const thresholdSchema = z.object({
  id: z.string(),
  valid_from: z.iso.date(),
  valid_until: z.iso.date().nullable(),
  no_tender_max: amount,
  zuta4_max: amount,
  zuta6_max: amount,
  index_value: amount.nullable(),
  source: z.string(),
  is_official: z.boolean(),
});
export const proposalSchema = z.object({
  id: z.string(),
  valid_from: z.iso.date(),
  index_value: amount,
  no_tender_max: amount,
  zuta4_max: amount,
  zuta6_max: amount,
  source: z.string(),
  status: z.literal('pending'),
});
export type Proposal = z.infer<typeof proposalSchema>;
export type Threshold = z.infer<typeof thresholdSchema>;
export async function loadProposals() {
  await requireRoles(['admin']);
  const [proposals, thresholds] = await Promise.all([
    rows('threshold_proposals', { status: 'eq.pending' }, z.array(proposalSchema)),
    rows('thresholds', {}, z.array(thresholdSchema)),
  ]);
  return { proposals, thresholds };
}
const decided = z.string().nullable();
/** A rejection carries its reason. 404 is either "already decided" or, before migration
 * 20261118040000 reaches the database, a function without the note: one retry without it
 * tells the two apart (the retry fails again with 404 when it was already decided). */
export async function decideProposal(id: string, approve: boolean, note: string | null = null) {
  try {
    await rpc('decide_threshold_proposal', { proposal: id, approve, note }, decided);
  } catch (error) {
    if (!(error instanceof DataError && error.status === 404)) throw error;
    await rpc('decide_threshold_proposal', { proposal: id, approve }, decided);
  }
}
