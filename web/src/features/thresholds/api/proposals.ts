import { z, rows, rpc, requireRoles } from '../../../data/rpc.ts';
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
export async function decideProposal(id: string, approve: boolean): Promise<void> {
  await rpc('decide_threshold_proposal', { proposal: id, approve }, z.string().nullable());
}
