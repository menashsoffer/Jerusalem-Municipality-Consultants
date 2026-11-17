import { Link, useLocation, useNavigate } from 'react-router';
import { Icon } from '../../../ui/icon.tsx';
import styles from './supplier.module.css';

/** Set by the catalog card's link, so the back button knows a search page is behind it. */
export interface FromCatalog {
  fromCatalog: true;
}
export function cameFromCatalog(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'fromCatalog' in state;
}

/**
 * Spec section 3. After a search, going back returns to the same history entry, where the
 * catalog restores its query and filters. Opened from a direct link, it goes to the catalog.
 */
export function BackButton() {
  const location = useLocation();
  const navigate = useNavigate();
  if (!cameFromCatalog(location.state)) {
    return (
      <Link to="/catalog" className={styles.back}>
        <Icon name="back" />
        לאיתור ספקים
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={styles.back}
      onClick={() => {
        void navigate(-1);
      }}
    >
      <Icon name="back" />
      חזרה לתוצאות החיפוש
    </button>
  );
}
