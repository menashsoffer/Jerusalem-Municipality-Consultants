// The account card at the end of the top bar (screens-spec-he.md 11 and 4.2): a circle with the
// first letter, the name and the main role. It links to the personal area; signed out, it signs in.
import { Link } from 'react-router';
import { getAdminSession } from '../data/rpc.ts';
import { tokenEmail } from '../data/snapshot.ts';
import { useCatalogSnapshot } from '../data/react-catalog.ts';
import { Icon } from '../ui/icon.tsx';
import styles from './nav/nav.module.css';
import { mainRole } from './screens.ts';

export function AccountMenu() {
  const access = useCatalogSnapshot()?.access;
  const token = getAdminSession()?.token;
  if (!access || !token) {
    return (
      <Link to="/auth" className={styles.account} aria-label="כניסה למערכת" title="כניסה למערכת">
        <span className={styles.circle}>
          <Icon name="person" />
        </span>
      </Link>
    );
  }
  return <AccountCard token={token} role={mainRole(access)} />;
}

function AccountCard({ token, role }: { token: string; role: string | null }) {
  const email = tokenEmail(token);
  const name = email?.split('@')[0];
  return (
    <Link to="/auth" className={styles.account}>
      <span className={styles.circle} aria-hidden="true">
        {email?.[0]?.toUpperCase() ?? <Icon name="person" />}
      </span>
      <span className={styles.who}>
        <bdi className={styles.name} dir="auto">
          {name ?? 'האזור האישי'}
        </bdi>
        {role && <span className={styles.role}>{role}</span>}
      </span>
    </Link>
  );
}
