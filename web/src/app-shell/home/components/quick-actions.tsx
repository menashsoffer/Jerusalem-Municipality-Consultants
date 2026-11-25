import { Link } from 'react-router';
import type { Access } from '../../../data/access.ts';
import { permitted } from '../../../data/rpc.ts';
import controls from '../../../ui/control.module.css';
import styles from '../home.module.css';

/** The three or four things people start from; each link only for whoever may use it. */
export function QuickActions({ access }: { access: Access }) {
  const editor = permitted(access, ['editor', 'unit_manager']);
  return (
    <section aria-labelledby="home-quick" className={styles.panel}>
      <h2 id="home-quick">פעולות מהירות</h2>
      <div className={styles.actions}>
        <Link to="/engagement" className={controls.button}>
          בקשת התקשרות חדשה
        </Link>
        <Link to="/route-check" className={controls.secondary}>
          איזה הליך מתאים לסכום?
        </Link>
        {editor && (
          <Link to="/supplier/new" className={controls.secondary}>
            הוספת ספק למאגר
          </Link>
        )}
        <Link to="/start" className={controls.secondary}>
          איך מתחילים
        </Link>
        {access.admin && (
          <Link to="/import" className={controls.secondary}>
            קליטת ספקים מאקסל
          </Link>
        )}
      </div>
    </section>
  );
}
