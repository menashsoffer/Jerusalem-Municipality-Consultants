import type { Proposal, Threshold } from '../api/proposals.ts';
import { monthLabel } from '../model/comparison.ts';
import { ProposalComparison } from './proposal-comparison.tsx';
import { DecisionForm } from './decision-form.tsx';
import styles from './proposal-card.module.css';
interface Props {
  proposal: Proposal;
  previous: Threshold | null;
}
export function ProposalCard({ proposal, previous }: Props) {
  const title = monthLabel(proposal.valid_from);
  return (
    <article className={styles.card}>
      <h2>{title}</h2>
      <p>
        מדד: <bdi>{proposal.index_value}</bdi>
      </p>
      <p>מקור המדד: {proposal.source}</p>
      {!previous && <p>לא נמצא סף קודם להשוואה.</p>}
      <ProposalComparison proposal={proposal} previous={previous} />
      <DecisionForm id={proposal.id} title={title} />
    </article>
  );
}
