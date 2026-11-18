import { Suspense } from 'react';
import { useLoaderData, type LoaderFunctionArgs } from 'react-router';
import { freshToken, identity, sessionToken } from '../../data/rpc.ts';
import { detail } from '../../data/site.ts';
import { useScreenData } from '../../data/react-screen-data.ts';
import {
  createSupplierDetailResource,
  supplierKey,
  useCatalogSnapshot,
  useSupplierDetail,
  type SupplierDetailResource,
} from '../../data/react-catalog.ts';
import { Skeleton } from '../../ui/skeleton.tsx';
import { israelToday } from '../../lib/dates.ts';
import { BackButton } from './components/back-button.tsx';
import { SupplierDetails } from './components/supplier-details.tsx';

/** Confirms the session against the server, then starts the detail request before rendering. */
export async function loader({ params }: LoaderFunctionArgs) {
  await identity();
  const id = params.id ?? '';
  return { resource: createSupplierDetailResource(sessionToken(), id, fetchDetail(id)) };
}

/** Each load takes a current token: a save reloads the card long after the visit began. */
const fetchDetail = (id: string) => async () => detail(await freshToken(), id);

function Detail({ resource }: { resource: SupplierDetailResource }) {
  const loaded = useSupplierDetail(resource);
  // Follows a save on this card (or in another tab) without loading the whole page again.
  const id = resource.supplierId;
  const data = useScreenData(supplierKey(id), loaded, fetchDetail(id)).value;
  const access = useCatalogSnapshot()?.access;
  const editor = access?.state === 'active' && access.editor;
  const admin = access?.state === 'active' && access.admin;
  return <SupplierDetails data={data} today={israelToday()} editor={editor} admin={admin} />;
}

export function SupplierPage() {
  const { resource } = useLoaderData<typeof loader>();
  return (
    <>
      <BackButton />
      <Suspense
        fallback={
          <>
            <h1 tabIndex={-1}>פרטי ספק</h1>
            <Skeleton shape="detail" label="טוען את פרטי הספק…" />
          </>
        }
      >
        <Detail resource={resource} />
      </Suspense>
    </>
  );
}
