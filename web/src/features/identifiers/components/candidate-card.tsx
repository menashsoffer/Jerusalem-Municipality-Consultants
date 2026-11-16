import { useId } from 'react';
import { DataTable } from '../../../ui/data-table.tsx';
import { type Candidate, SOURCES, nameHint } from '../model/candidate.ts';
import { DecisionForm } from './decision-form.tsx';
import styles from './candidate.module.css';
interface Props {
  candidate: Candidate;
  supplier: string;
}
export function CandidateCard({ candidate, supplier }: Props) {
  const heading = useId();
  return (
    <article className={styles.card} aria-labelledby={heading}>
      <h2 id={heading}>{supplier}</h2>
      <p>מקור המועמד: {SOURCES[candidate.source]}</p>
      <p>
        סוג המזהה: {candidate.scheme === 'company' ? 'מספר חברה' : 'מספר עמותה'} —{' '}
        <bdi dir="ltr">{candidate.value}</bdi>
      </p>
      <DataTable
        caption="השוואת השמות"
        columns={[
          { id: 'kind', label: 'מקור השם' },
          { id: 'name', label: 'השם' },
        ]}
        rows={[
          { id: 'supplier', cells: { kind: 'הספק באתר', name: supplier } },
          { id: 'searched', cells: { kind: 'השם שנשלח לחיפוש', name: candidate.searched_name } },
          {
            id: 'registrar',
            cells: { kind: 'השם במרשם', name: candidate.registrar_name ?? 'לא נמסר' },
          },
        ]}
      />
      <p>{nameHint(supplier, candidate.registrar_name)}</p>
      <p>מצב במרשם: {candidate.registrar_status ?? 'לא נמסר'}</p>
      <DecisionForm id={candidate.id} supplier={supplier} />
    </article>
  );
}
