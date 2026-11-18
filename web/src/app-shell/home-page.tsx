import { Link } from 'react-router';

import { useCatalogSnapshot } from '../data/react-catalog.ts';
import { identity } from '../data/rpc.ts';
import { Notice } from '../ui/notice.tsx';
import { PageHeader } from '../ui/page-header.tsx';
import { allowedScreens, type AdminScreen } from './screens.ts';
import styles from './home-page.module.css';

function Cards({ title, screens }: { title: string; screens: AdminScreen[] }) {
  if (!screens.length) return null;
  return (
    <section aria-label={title}>
      <h2>{title}</h2>
      <ul className={styles.grid}>
        {screens.map((screen) => (
          <li key={screen.to} className={styles.card}>
            <Link to={screen.to} className={styles.link}>
              {screen.title}
            </Link>
            <span className={styles.description}>{screen.description}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The cards depend on the user's roles, so they wait for server access. */
export async function loader() {
  await identity();
  return null;
}

/** Landing screen of the admin section: only the screens this user may open (spec 8.1). */
export function HomePage() {
  const access = useCatalogSnapshot()?.access;
  const screens = allowedScreens(access);
  return (
    <>
      <PageHeader title="ניהול" lead="המסכים שמותרים לך, ועבודה שממתינה לטיפול." />
      {access && !screens.length && (
        <Notice tone="info" title="אין לך מסכי ניהול.">
          המסכים כאן מיועדים לעורכים, למנהלי יחידות, למבקרים ולמנהל המערכת.
        </Notice>
      )}
      <Cards title="ממתין לטיפול" screens={screens.filter((s) => s.group === 'work')} />
      <Cards title="כלים" screens={screens.filter((s) => s.group === 'tools')} />
    </>
  );
}
