import { useDeferredValue, useState } from 'react';
import { useLoaderData, useNavigation } from 'react-router';
import { Button } from '../../ui/button.tsx';
import { EmptyState } from '../../ui/empty-state.tsx';
import { FormField } from '../../ui/form-field.tsx';
import { Notice } from '../../ui/notice.tsx';
import { PageHeader } from '../../ui/page-header.tsx';
import { SelectField } from '../../ui/select-field.tsx';
import { Skeleton } from '../../ui/skeleton.tsx';
import { loadCandidates } from './api/candidates.ts';
import { SOURCES, type Candidate } from './model/candidate.ts';
import { listCandidates, matchLevel, type ListFilter, type Listed } from './model/match.ts';
import { CandidateRow } from './components/candidate-row.tsx';
import styles from './components/candidate.module.css';

export const loader = loadCandidates;
const PAGE = 25;

function Filters({ filter, change }: { filter: ListFilter; change: (next: ListFilter) => void }) {
  return (
    <search aria-label="סינון מועמדים" className={styles.filters}>
      <SelectField
        field={{ label: 'מקור' }}
        select={{
          value: filter.source,
          onChange: (e) => {
            change({ ...filter, source: e.currentTarget.value as Candidate['source'] | '' });
          },
          children: [
            <option key="" value="">
              כל המקורות
            </option>,
            ...Object.entries(SOURCES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            )),
          ],
        }}
      />
      <FormField
        field={{ label: 'חיפוש לפי שם ספק' }}
        input={{
          type: 'search',
          value: filter.query,
          onChange: (e) => {
            change({ ...filter, query: e.currentTarget.value });
          },
        }}
      />
    </search>
  );
}

function useList() {
  const data = useLoaderData<typeof loader>();
  const names = new Map(data.suppliers.map((s) => [s.id, s.display_name]));
  return data.candidates.map((candidate) => {
    const supplier = names.get(candidate.supplier_id) ?? 'שם הספק אינו זמין';
    return { candidate, supplier, level: matchLevel(supplier, candidate.registrar_name) };
  });
}

function Results({ shown, pages, more }: { shown: Listed[]; pages: number; more: () => void }) {
  return (
    <>
      <p aria-live="polite">
        מוצגים {String(Math.min(shown.length, pages * PAGE))} מתוך {String(shown.length)}
      </p>
      {shown.length ? (
        <div className={styles.list}>
          {shown.slice(0, pages * PAGE).map((row) => (
            <CandidateRow key={row.candidate.id} {...row} />
          ))}
        </div>
      ) : (
        <EmptyState title="אין מועמדים שמתאימים לסינון" />
      )}
      {shown.length > pages * PAGE && (
        <Button
          variant="secondary"
          className={styles.more}
          onClick={() => {
            more();
          }}
        >
          הצגת 25 נוספים
        </Button>
      )}
    </>
  );
}

/** Supplier ID candidates (screens-spec 7): filter, closest names first, 25 at a time. */
export function IdentifiersPage() {
  const all = useList();
  const navigation = useNavigation();
  const [filter, setFilter] = useState<ListFilter>({ source: '', query: '' });
  const [pages, setPages] = useState(1);
  const shown = listCandidates(all, useDeferredValue(filter));
  return (
    <div className={styles.page}>
      <PageHeader
        title={`מועמדי מזהה ספק (${String(all.length)})`}
        back={{ to: '/admin', label: 'ניהול' }}
      />
      <Notice tone="info" title="מועמד הוא הצעה בלבד. קבלה שולחת אותו לאימות של אדם נוסף." />
      {navigation.state === 'loading' ? (
        <Skeleton />
      ) : all.length === 0 ? (
        <EmptyState title="אין מועמדים ממתינים">
          <p>כל המועמדים הקיימים טופלו.</p>
        </EmptyState>
      ) : (
        <>
          <Filters
            filter={filter}
            change={(next) => {
              setFilter(next);
              setPages(1);
            }}
          />
          <Results
            shown={shown}
            pages={pages}
            more={() => {
              setPages((n) => n + 1);
            }}
          />
        </>
      )}
    </div>
  );
}
