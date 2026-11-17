import { Link, useLoaderData } from 'react-router';
import { EmptyState } from '../../ui/empty-state.tsx';
import { loadControl } from './api/control.ts';
import { sourceLabel } from './model/labels.ts';
import { BatchTable, JobTable, RegistryTable } from './components/control-tables.tsx';

export const loader = loadControl;

function Summary({ data }: { data: Awaited<ReturnType<typeof loader>> }) {
  const candidates = Object.entries(data.candidates);
  return (
    <ul aria-label="סיכום">
      <li>
        מזהי ספק שממתינים לאישור: <bdi>{data.identifiers_pending}</bdi>
      </li>
      {candidates.map(([source, count]) => (
        <li key={source}>
          מועמדים ממתינים מ{sourceLabel(source)}: <bdi>{count}</bdi>{' '}
          <Link to="/identifiers">לבדיקה</Link>
        </li>
      ))}
      <li>
        שמות ספק שחוזרים יותר מפעם אחת: <bdi>{data.same_names}</bdi> (שם זהה אינו הוכחה שזה אותו
        ספק)
      </li>
      <li>
        מתקנים עם פרטי אולם: <bdi>{data.venues}</bdi>
      </li>
    </ul>
  );
}

export function LoadControlPage() {
  const data = useLoaderData<typeof loader>();
  return (
    <>
      <h1 tabIndex={-1}>בקרת טעינה</h1>
      <p>הנתונים נקראים מרישומי הטעינה במסד, ולא מגיליונות הקובץ.</p>
      <Summary data={data} />
      <RegistryTable registries={data.registries} />
      {data.batches.length ? (
        <BatchTable batches={data.batches} />
      ) : (
        <EmptyState title="אין טעינות קבצים רשומות">
          <p>טעינת קובץ שנרשמת במסד תופיע כאן.</p>
        </EmptyState>
      )}
      <JobTable jobs={data.jobs} />
    </>
  );
}
