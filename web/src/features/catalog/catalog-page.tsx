import { Suspense } from 'react';
import { Await, Link, useLoaderData } from 'react-router';
import { identity, permitted, type Identity } from '../../data/rpc.ts';
import { useCatalogSnapshot } from '../../data/react-catalog.ts';
import { DataError } from '../../data/client.ts';
import { Skeleton } from '../../ui/skeleton.tsx';
import { replaceShortlist, useShortlist } from '../../lib/shortlist.ts';
import { PageHeader } from '../../ui/page-header.tsx';
import { Button } from '../../ui/button.tsx';
import controls from '../../ui/control.module.css';
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
/** Pinned to the bottom while browsing, so the request is one step away (spec 1.7). */
function ShortlistBar() {
  const picked = useShortlist();
  if (!picked.length) return null;
  return (
    <section className={styles.shortlist} aria-label="בקשת התקשרות">
      <p>
        {picked.length === 1 ? (
          'ספק אחד בבקשה'
        ) : (
          <>
            <bdi>{picked.length}</bdi> ספקים בבקשה
          </>
        )}
      </p>
      <div className={styles.shortlistActions}>
        <Button
          variant="quiet"
          onClick={() => {
            replaceShortlist([]);
          }}
        >
          ניקוי
        </Button>
        <Link to="/engagement" className={controls.button}>
          מעבר לבקשה
        </Link>
      </div>
    </section>
  );
}
function AddSupplier() {
  return (
    <Link to="/supplier/new" className={controls.secondary}>
      הוספת ספק
    </Link>
  );
}
export function CatalogPage() {
  const data = useLoaderData<typeof loader>(),
    state = useCatalogSnapshot();
  return (
    <>
      <PageHeader
        title="איתור ספקים"
        action={
          state?.access && permitted(state.access, ['editor', 'unit_manager']) ? (
            <AddSupplier />
          ) : null
        }
      />
      <Suspense fallback={state?.catalog ? null : <Skeleton />}>
        <Await resolve={data.verified}>{(who) => <AccessCheck who={who} />}</Await>
      </Suspense>
      {state?.catalog && <CatalogBrowser key={state.userId} state={state} today={data.today} />}
      <ShortlistBar />
    </>
  );
}
