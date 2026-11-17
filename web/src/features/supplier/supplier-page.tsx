import { Suspense } from 'react';
import { useLoaderData, type LoaderFunctionArgs } from 'react-router';
import { identity, sessionToken } from '../../data/rpc.ts';
import {
  createSupplierDetailResource,
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
  return { resource: createSupplierDetailResource(sessionToken(), params.id ?? '') };
}

function Detail({ resource }: { resource: SupplierDetailResource }) {
  const data = useSupplierDetail(resource);
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
            <Skeleton />
          </>
        }
      >
        <Detail resource={resource} />
      </Suspense>
    </>
  );
}
