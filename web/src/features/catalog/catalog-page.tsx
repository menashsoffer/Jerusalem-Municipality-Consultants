import { Suspense } from 'react';
import { Await, useLoaderData } from 'react-router';
import { identity, type Identity } from '../../data/rpc.ts';
import { useCatalogSnapshot } from '../../data/react-catalog.ts';
import { DataError } from '../../data/client.ts';
import { Skeleton } from '../../ui/skeleton.tsx';
import { israelToday } from './model/filters.ts';
import { CatalogBrowser } from './components/catalog-browser.tsx';
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
export function CatalogPage() {
  const data = useLoaderData<typeof loader>(),
    state = useCatalogSnapshot();
  return (
    <>
      <h1 tabIndex={-1}>איתור ספקים</h1>
      <Suspense fallback={state?.catalog ? null : <Skeleton />}>
        <Await resolve={data.verified}>{(who) => <AccessCheck who={who} />}</Await>
      </Suspense>
      {state?.catalog && <CatalogBrowser key={state.userId} state={state} today={data.today} />}
    </>
  );
}
