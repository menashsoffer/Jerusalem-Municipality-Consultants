import { Suspense } from 'react';
import { Await, Link, useLoaderData } from 'react-router';
import { identity, type Identity } from '../../data/rpc.ts';
import { useCatalogSnapshot } from '../../data/react-catalog.ts';
import { DataError } from '../../data/client.ts';
import { Skeleton } from '../../ui/skeleton.tsx';
import { useShortlist } from '../../lib/shortlist.ts';
import { israelToday } from './model/filters.ts';
import { CatalogBrowser } from './components/catalog-browser.tsx';
import styles from './components/catalog.module.css';
/** Start the catalog request in the loader, before mounting React content. */
export function loader() {
  const verified = identity();
  void verified.catch(() => undefined);
  return { verified, today: israelToday() };
}
function AccessCheck({ who }: { who: Identity }) {
  if (!who.access.member || who.access.state !== 'active') throw new DataError(403);
  return null;
}
/** Stays in view while browsing, so the request is one step away. */
function ShortlistBar() {
  const picked = useShortlist();
  if (!picked.length) return null;
  return (
    <p className={styles.shortlist} role="region" aria-label="בקשת התקשרות">
      <bdi>{picked.length}</bdi> ספקים נבחרו. <Link to="/engagement">מעבר לבקשת התקשרות</Link>
    </p>
  );
}
export function CatalogPage() {
  const data = useLoaderData<typeof loader>(),
    state = useCatalogSnapshot();
  return (
    <>
      <h1 tabIndex={-1}>איתור ספקים</h1>
      <aside aria-label="הערה על הנתונים" className={styles.note}>
        הנתונים חולצו מפרסומי העירייה וטרם אומתו במלואם. יש לבדוק את מסמך המקור ואת תנאי ההתקשרות
        לפני קבלת החלטה. חיפושים ופעולות של משתמשים מחוברים עשויים להירשם לצורכי בקרה.
      </aside>
      {state?.access?.state === 'active' && state.access.editor && (
        <p>
          <Link to="/supplier/new">הוספת ספק למאגר</Link>
        </p>
      )}
      <Suspense fallback={state?.catalog ? null : <Skeleton />}>
        <Await resolve={data.verified}>{(who) => <AccessCheck who={who} />}</Await>
      </Suspense>
      <ShortlistBar />
      {state?.catalog && <CatalogBrowser key={state.userId} state={state} today={data.today} />}
    </>
  );
}
