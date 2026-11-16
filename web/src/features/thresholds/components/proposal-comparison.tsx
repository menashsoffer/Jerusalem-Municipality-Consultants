import { DataTable } from '../../../ui/data-table.tsx';
import type { Proposal, Threshold } from '../api/proposals.ts';
import { AMOUNT_LABELS, formatMoney, monthLabel } from '../model/comparison.ts';
interface Props {
  proposal: Proposal;
  previous: Threshold | null;
}
export function ProposalComparison({ proposal, previous }: Props) {
  return (
    <DataTable
      caption={`השוואת הספים — ${monthLabel(proposal.valid_from)}`}
      columns={[
        { id: 'kind', label: 'מסלול' },
        {
          id: 'previous',
          label: previous ? `סף קודם (${monthLabel(previous.valid_from)})` : 'סף קודם',
        },
        { id: 'proposed', label: 'סף מוצע' },
      ]}
      rows={Object.entries(AMOUNT_LABELS).map(([key, label]) => ({
        id: key,
        cells: {
          kind: label,
          previous: previous ? (
            <bdi>{formatMoney(previous[key as keyof typeof AMOUNT_LABELS])}</bdi>
          ) : (
            'לא זמין'
          ),
          proposed: <bdi>{formatMoney(proposal[key as keyof typeof AMOUNT_LABELS])}</bdi>,
        },
      }))}
    />
  );
}
