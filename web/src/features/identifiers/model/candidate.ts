import { z } from '../../../data/rpc.ts';
export const candidateSchema = z.object({
  id: z.string(),
  supplier_id: z.string(),
  scheme: z.enum(['company', 'nonprofit']),
  value: z.string().regex(/^[0-9]{5,9}$/),
  source: z.enum(['companies_registrar', 'guidestar']),
  registrar_name: z.string().nullable(),
  registrar_status: z.string().nullable(),
  searched_name: z.string(),
  found_at: z.string(),
});
export type Candidate = z.infer<typeof candidateSchema>;
export const SOURCES = { companies_registrar: 'רשם החברות', guidestar: 'GuideStar — רשם העמותות' };
export function nameHint(supplier: string, registered: string | null): string {
  const normalize = (name: string) =>
    name
      .normalize('NFKC')
      .toLocaleLowerCase('he')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  return registered && normalize(registered) === normalize(supplier)
    ? 'השמות זהים לאחר נרמול טקסט. זהו רמז בלבד, ולא הוכחה לזהות הספק.'
    : 'יש להשוות את השמות והאסמכתאות ידנית. דמיון בשם אינו הוכחה לזהות הספק.';
}
