import { Link } from 'react-router';
import type { Supplier } from '../../../catalog-model.ts';
import {
  contactSummary,
  inactiveLine,
  supplierBadges,
  supplierFields,
} from '../model/card-labels.ts';
import { Button } from '../../../ui/button.tsx';
import { SHORTLIST_MAX, toggleShortlist } from '../../../lib/shortlist.ts';
import { VenueFacts } from './venue-facts.tsx';
import styles from './catalog.module.css';
const FIELDS_SHOWN = 3;
/** What the supplier does, as quiet tags; the rest of the listings wait on the supplier screen. */
function Fields({ supplier, today }: { supplier: Supplier; today: string }) {
  const fields = supplierFields(supplier.memberships, today);
  const more = fields.length - FIELDS_SHOWN;
  return (
    <ul className={styles.fields} aria-label="תחום">
      {fields.slice(0, FIELDS_SHOWN).map((field) => (
        <li key={field}>{field}</li>
      ))}
      {more > 0 && <li className={styles.more}>ועוד {String(more)}</li>}
    </ul>
  );
}
interface Props {
  supplier: Supplier;
  today: string;
  deferred: boolean;
  /** Whether the card is in the request, or null when the request is full without it. */
  picked: boolean | null;
}
/** The database blocks approaches to an inactive supplier; the disabled button explains it. */
function PickButton({ supplier, picked }: Pick<Props, 'supplier' | 'picked'>) {
  if (picked === null) {
    return (
      <Button variant="secondary" disabled>
        הבקשה מלאה ({String(SHORTLIST_MAX)} ספקים)
      </Button>
    );
  }
  if (supplier.inactive && !picked) {
    return (
      <Button variant="secondary" disabled aria-describedby={`inactive-${supplier.id}`}>
        הוספה לבקשת התקשרות
      </Button>
    );
  }
  return (
    <Button
      variant="secondary"
      aria-pressed={picked}
      aria-label={`בקשת התקשרות: ${supplier.name}`}
      onClick={() => {
        toggleShortlist(supplier.id);
      }}
    >
      {picked ? 'בבקשה, להסרה' : 'הוספה לבקשת התקשרות'}
    </Button>
  );
}
export function SupplierCard({ supplier, today, deferred, picked }: Props) {
  return (
    <li className={deferred ? styles.deferred : styles.item}>
      <article className={styles.card}>
        <header className={styles.cardHead}>
          <h3>
            <Link
              to={`/supplier/${encodeURIComponent(supplier.id)}`}
              aria-label={`פרטי ספק: ${supplier.name}`}
            >
              {supplier.name}
            </Link>
          </h3>
          <ul className={styles.badges} aria-label="מצב הספק">
            {supplierBadges(supplier).map((badge) => (
              <li key={badge.text} className={[styles.badge, styles[badge.tone]].join(' ')}>
                {badge.text}
              </li>
            ))}
          </ul>
        </header>
        {supplier.inactive && (
          <p role="note" id={`inactive-${supplier.id}`} className={styles.inactive}>
            {inactiveLine(supplier.inactive)}
          </p>
        )}
        <Fields supplier={supplier} today={today} />
        <VenueFacts venue={supplier.venue} />
        <footer className={styles.cardFoot}>
          <span className={styles.contact}>{contactSummary(supplier.contactKinds)}</span>
          <PickButton supplier={supplier} picked={picked} />
        </footer>
      </article>
    </li>
  );
}
