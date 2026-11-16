import { z } from '../../../data/rpc.ts';
export const requestSchema = z.object({
  id: z.string(),
  proposed_name: z.string(),
  description: z.string(),
  parent_id: z.string().nullable(),
  source_reference: z.string().nullable(),
  created_by: z.string().nullable(),
});
export type CategoryRequest = z.infer<typeof requestSchema>;
type Decision =
  | { error: string }
  | { decision: 'approved' | 'rejected' | 'linked'; note: string; category_id: string | null };
const decisionSchema = z.enum(['approved', 'rejected', 'linked']);
function formText(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
}
export function parseDecision(form: FormData): Decision {
  const parsed = decisionSchema.safeParse(form.get('decision'));
  if (!parsed.success) return { error: 'יש לבחור החלטה.' };
  const decision = parsed.data,
    note = formText(form, 'note'),
    category = formText(form, 'category_id');
  if (decision === 'rejected' && note.length < 2) return { error: 'יש לציין נימוק לדחייה.' };
  if (decision === 'linked' && !category) return { error: 'יש לבחור קטגוריה קיימת לקישור.' };
  return { decision, note, category_id: decision === 'linked' ? category : null };
}
