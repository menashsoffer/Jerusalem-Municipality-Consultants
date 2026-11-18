import { useLoaderData, useNavigation } from 'react-router';
import { EmptyState } from '../../ui/empty-state.tsx';
import { PageHeader } from '../../ui/page-header.tsx';
import { Skeleton } from '../../ui/skeleton.tsx';
import { israelToday } from '../../lib/dates.ts';
import { loadProposals } from './api/proposals.ts';
import { previousThreshold, thresholdOn } from './model/comparison.ts';
import { CurrentCard } from './components/current-card.tsx';
import { ProposalCard } from './components/proposal-card.tsx';
import styles from './components/proposal-card.module.css';
export const loader = loadProposals;
export function ThresholdsPage() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  return (
    <div className={styles.page}>
      <PageHeader
        title="אישור הסף החודשי"
        lead="הצעה אינה משנה את הספים עד שמנהל מאשר אותה."
        back={{ to: '/admin', label: 'ניהול' }}
      />
      <CurrentCard current={thresholdOn(israelToday(), data.thresholds)} />
      {navigation.state === 'loading' ? (
        <Skeleton />
      ) : data.proposals.length === 0 ? (
        <EmptyState title="אין הצעות ממתינות">
          <p>הצעה חדשה נוצרת אחרי פרסום המדד החודשי.</p>
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
    </div>
  );
}
