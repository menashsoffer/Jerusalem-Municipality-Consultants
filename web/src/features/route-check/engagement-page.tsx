import { Link, useLoaderData, type LoaderFunctionArgs } from 'react-router';
import { EmptyState } from '../../ui/empty-state.tsx';
import { PageHeader } from '../../ui/page-header.tsx';
import { identity } from '../../data/rpc.ts';
import { getCatalogState } from '../../data/site.ts';
import { loadEngagementFor } from './api/engagement.ts';
import { loadSaved } from './api/saved.ts';
import { NewRequest } from './components/new-request.tsx';
import { ReloadSavedProvider, useSavedList } from './components/saved-list.tsx';
import { SavedRequests } from './components/saved-requests.tsx';
import styles from './components/route-check.module.css';

/** The new request and the saved requests load together (screens-spec-he.md 2). */
export async function loader(args: LoaderFunctionArgs) {
  // One identity() for both: two snapshot loads at once would cancel the first.
  const who = await identity();
  const [engagement, saved] = await Promise.all([loadEngagementFor(args, who), loadSaved(who)]);
  return { ...engagement, saved };
}

function unitNames(): Map<string, string> {
  const units = getCatalogState()?.catalog?.units ?? [];
  return new Map(units.map((unit) => [unit.id, unit.name]));
}

export function EngagementPage() {
  const data = useLoaderData<typeof loader>();
  const saved = useSavedList(data.saved);
  return (
    <ReloadSavedProvider value={saved.reload}>
      <div className={styles.page}>
        <PageHeader
          title="בקשות התקשרות"
          lead="הכלי מחשב מסלול לפי הנתונים שהוזנו. הוא אינו מאשר התקשרות ואינו קובע שספק זכאי."
        />
        {data.suppliers.length ? (
          <NewRequest data={data} />
        ) : (
          <EmptyState title="לא נבחרו ספקים לבקשה חדשה">
            <p>
              בוחרים ספקים ב<Link to="/catalog">איתור ספקים</Link> ולוחצים "הוספה לבקשה".
            </p>
          </EmptyState>
        )}
        {saved.list && (
          <SavedRequests
            requests={saved.list}
            stale={saved.stale}
            units={unitNames()}
            today={data.today}
          />
        )}
      </div>
    </ReloadSavedProvider>
  );
}
