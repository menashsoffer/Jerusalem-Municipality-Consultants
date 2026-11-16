import { useLoaderData, useNavigation } from 'react-router';
import { EmptyState } from '../../ui/empty-state.tsx';
import { Skeleton } from '../../ui/skeleton.tsx';
import { loadCandidates } from './api/candidates.ts';
import { CandidateCard } from './components/candidate-card.tsx';
export const loader = loadCandidates;
export function IdentifiersPage() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  return (
    <>
      <h1 tabIndex={-1}>מועמדי מזהה ספק</h1>
      <p>התוצאות מרשם החברות ומ־GuideStar הן מועמדות בלבד עד להחלטה ידנית ולאימות נוסף.</p>
      {navigation.state === 'loading' ? (
        <Skeleton />
      ) : data.candidates.length === 0 ? (
        <EmptyState title="אין מועמדים ממתינים">
          <p>כל המועמדים הקיימים טופלו.</p>
        </EmptyState>
      ) : (
        data.candidates.map((candidate) => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            supplier={
              data.suppliers.find((s) => s.id === candidate.supplier_id)?.display_name ??
              'שם הספק אינו זמין'
            }
          />
        ))
      )}
    </>
  );
}
