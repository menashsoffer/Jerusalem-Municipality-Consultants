import { z, rows, rpc, requireRoles } from '../../../data/rpc.ts';
import { candidateSchema } from '../model/candidate.ts';
export async function loadCandidates() {
  await requireRoles(['admin']);
  const [candidates, suppliers] = await Promise.all([
    rows('identifier_candidates', { status: 'eq.pending' }, z.array(candidateSchema)),
    rows(
      'suppliers',
      { status: 'neq.merged' },
      z.array(z.object({ id: z.string(), display_name: z.string() })),
    ),
  ]);
  return { candidates, suppliers };
}
export async function decideCandidate(id: string, accept: boolean): Promise<void> {
  await rpc('decide_identifier_candidate', { candidate: id, accept }, z.string().nullable());
}
