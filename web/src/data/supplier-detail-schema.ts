import { z } from './validation.ts';

const nullableText = z.string().nullable();
const json = z.json();
export const detailSchema = z.object({
  identifiers: z.array(
    z.object({
      id: z.string(),
      supplier_id: z.string(),
      scheme: z.string(),
      value: z.string(),
      source: z.string(),
      review_status: z.string(),
      registrar_name: nullableText,
      registrar_status: nullableText,
      checked_at: nullableText,
      verified_by: nullableText,
      verified_at: nullableText,
      created_at: z.string(),
      created_by: nullableText,
      updated_at: z.string(),
    }),
  ),
  audit: z
    .array(
      z.object({
        id: z.number(),
        actor_id: nullableText,
        table_name: z.string(),
        row_id: z.string(),
        operation: z.string(),
        changes: json,
        created_at: z.string(),
      }),
    )
    .nullable(),
});
