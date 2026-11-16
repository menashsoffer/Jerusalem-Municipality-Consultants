import { useLoaderData, useNavigation } from 'react-router';
import { EmptyState } from '../../ui/empty-state.tsx';
import { Skeleton } from '../../ui/skeleton.tsx';
import { loadProposals } from './api/proposals.ts';
import { previousThreshold } from './model/comparison.ts';
import { ProposalCard } from './components/proposal-card.tsx';
export const loader = loadProposals;
export function ThresholdsPage() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  return (
    <>
      <h1 tabIndex={-1}>אישור הסף החודשי</h1>
      <p>הצעת עדכון אינה משנה את הספים עד לאישור מנהל. מקור המדד מופיע בכל הצעה.</p>
      {navigation.state === 'loading' ? (
        <Skeleton />
      ) : data.proposals.length === 0 ? (
        <EmptyState title="אין הצעות ממתינות">
          <p>כל ההצעות הקיימות טופלו.</p>
        </EmptyState>
      ) : (
        data.proposals.map((proposal) => (
          <ProposalCard
            key={proposal.id}
            proposal={proposal}
            previous={previousThreshold(proposal, data.thresholds)}
          />
        ))
      )}
    </>
  );
}
