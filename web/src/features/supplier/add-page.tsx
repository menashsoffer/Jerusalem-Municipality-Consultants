import { Link, useLoaderData } from 'react-router';
import { DataError } from '../../data/client.ts';
import { identity } from '../../data/rpc.ts';
import { EmptyState } from '../../ui/empty-state.tsx';
import { loadWriteContext } from './api/write.ts';
import { AddForm } from './components/add-form.tsx';

/** Editors only; the database checks the unit grant again when the row is saved. */
export async function loader() {
  const who = await identity();
  if (who.access.state !== 'active' || !who.access.editor) throw new DataError(403);
  return { context: await loadWriteContext() };
}

export function AddSupplierPage() {
  const { context } = useLoaderData<typeof loader>();
  return (
    <>
      <p>
        <Link to="/catalog">חזרה לאיתור ספקים</Link>
      </p>
      <h1 tabIndex={-1}>הוספת ספק למאגר</h1>
      <p>רשומה חדשה ממתינה לאימות של משתמש אחר.</p>
      {context.versions.length === 0 ? (
        <EmptyState title="אין מאגר זמין ביחידה שלך">
          <p>אפשר להוסיף ספק רק למאגר של יחידה שבה יש לך הרשאת עריכה.</p>
        </EmptyState>
      ) : (
        <AddForm context={context} />
      )}
    </>
  );
}
