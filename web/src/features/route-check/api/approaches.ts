// The approaches of a saved request and their answers (supplier-approaches-spec-he.md 6.2).
// The database keeps an offer's amount, note and file out until the deadline has passed.
import { z, rpc } from '../../../data/rpc.ts';
import { CHANNELS } from '../model/approaches.ts';
import '../model/approach-reasons.ts';

const answerSchema = z.object({
  id: z.string(),
  answer: z.enum(['offer', 'declined']),
  decline_reason: z.string().nullable(),
  source: z.enum(['portal', 'staff']),
  received_on: z.string().nullable(),
  created_at: z.string(),
  offer_amount: z.number().nullish(),
  offer_includes_vat: z.boolean().nullish(),
  note: z.string().nullish(),
  file_path: z.string().nullish(),
});

const approachSchema = z.object({
  id: z.string(),
  supplier_id: z.string(),
  supplier_name: z.string(),
  channel: z.enum(CHANNELS).catch('other'),
  approached_on: z.iso.date(),
  respond_by: z.iso.date().nullable(),
  sealed: z.boolean(),
  answer: answerSchema.nullable(),
});
export type RequestApproach = z.infer<typeof approachSchema>;

export function loadRequestApproaches(request: string): Promise<RequestApproach[]> {
  return rpc('request_approaches', { request_id: request }, z.array(approachSchema));
}
