import { z, requireRoles, rpc } from '../../../data/rpc.ts';

const count = z.number().int().nonnegative();
const controlSchema = z.object({
  jobs: z.array(
    z.object({
      job: z.string(),
      status: z.enum(['running', 'ok', 'failed']),
      started_at: z.string(),
      finished_at: z.string().nullable(),
    }),
  ),
  batches: z.array(
    z.object({
      script_name: z.string(),
      status: z.string(),
      row_count: count,
      created_at: z.string(),
      pending: count,
      duplicates: count,
    }),
  ),
  registries: z.array(
    z.object({
      name: z.string(),
      status: z.string(),
      memberships: count,
      needs_review: count,
      verified: count,
    }),
  ),
  candidates: z.record(z.string(), count),
  identifiers_pending: count,
  same_names: count,
  venues: count,
});
export type LoadControl = z.infer<typeof controlSchema>;

const errorsSchema = z.array(
  z.object({
    kind: z.string(),
    screen: z.string(),
    failures: z.coerce.number().int().nonnegative(),
    last_at: z.string(),
  }),
);
export type ErrorRow = z.infer<typeof errorsSchema>[number];

/** error-handling-spec-he.md section 8: administrators only. Null before the migration. */
async function errorSummary(): Promise<ErrorRow[] | null> {
  try {
    return await rpc('error_summary', {}, errorsSchema);
  } catch {
    return null;
  }
}

export async function loadControl(): Promise<LoadControl & { errors: ErrorRow[] | null }> {
  const who = await requireRoles(['admin', 'auditor']);
  const [control, errors] = await Promise.all([
    rpc('load_control', {}, controlSchema),
    who.access.admin ? errorSummary() : Promise.resolve(null),
  ]);
  return { ...control, errors };
}
