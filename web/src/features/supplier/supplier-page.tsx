import { Suspense } from 'react';
import { Link, useLoaderData, type LoaderFunctionArgs } from 'react-router';
import { identity, sessionToken } from '../../data/rpc.ts';
import {
  createSupplierDetailResource,
  useCatalogSnapshot,
  useSupplierDetail,
  type SupplierDetailResource,
} from '../../data/react-catalog.ts';
import { Skeleton } from '../../ui/skeleton.tsx';
import { israelToday } from '../../lib/dates.ts';
import { EditForms } from './components/edit-forms.tsx';
import { StatusForm } from './components/status-form.tsx';
import { SupplierDetails } from './components/supplier-details.tsx';
import styles from './components/supplier.module.css';

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
  return (
    <>
      <h1 tabIndex={-1}>{data.supplier.display_name}</h1>
      <SupplierDetails data={data} />
      {editor && <EditForms data={data} />}
      {admin && <StatusForm data={data} today={israelToday()} />}
    </>
  );
}

export function SupplierPage() {
  const { resource } = useLoaderData<typeof loader>();
  return (
    <>
      <Link to="/catalog" className={styles.back}>
        חזרה לאיתור ספקים
      </Link>
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
