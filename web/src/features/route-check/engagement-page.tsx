import { useState } from 'react';
import { Link, useLoaderData, useNavigate } from 'react-router';
import { EmptyState } from '../../ui/empty-state.tsx';
import { toggleShortlist } from '../../lib/shortlist.ts';
import { loadEngagement } from './api/engagement.ts';
import type { CheckResult } from './model/result.ts';
import { DraftForm } from './components/draft-form.tsx';
import { PickedList } from './components/picked-list.tsx';
import { ResultPanel } from './components/result-panel.tsx';
import { ShortlistTools } from './components/shortlist-tools.tsx';
import styles from './components/route-check.module.css';

export const loader = loadEngagement;

export function EngagementPage() {
  const data = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [checked, setChecked] = useState<{ result: CheckResult; requestId: string | null }>();
  if (!data.suppliers.length) {
    return (
      <>
        <h1 tabIndex={-1}>בקשת התקשרות</h1>
        <EmptyState title="לא נבחרו ספקים">
          <p>
            אפשר להוסיף ספקים מ<Link to="/catalog">הקטלוג</Link>.
          </p>
        </EmptyState>
      </>
    );
  }
  return (
    <div className={styles.page}>
      <h1 tabIndex={-1}>בקשת התקשרות</h1>
      <p className={styles.intro}>
        הכלי מחשב מסלול לפי הנתונים שהוזנו. הוא אינו מאשר התקשרות ואינו קובע שספק זכאי. כמה הצעות
        נדרשות ומאיזה מאגר מופיע בתוצאת הבדיקה.
      </p>
      <PickedList
        suppliers={data.suppliers}
        remove={(id) => {
          toggleShortlist(id);
          // Drop a shared list from the address so the loader reads the updated one.
          void navigate('/engagement', { replace: true });
        }}
      />
      <DraftForm
        units={data.units}
        today={data.today}
        complete={(result, requestId) => {
          setChecked({ result, requestId });
        }}
      />
      {checked && <ResultPanel result={checked.result} />}
      <ShortlistTools
        suppliers={data.suppliers}
        today={data.today}
        requestId={checked?.requestId ?? null}
      />
    </div>
  );
}
