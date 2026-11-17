import { Link } from 'react-router';
import { type Supplier, type Membership, validity } from '../../../catalog-model.ts';
import {
  contactSummary,
  inactiveLine,
  membershipState,
  supplierBadges,
} from '../model/card-labels.ts';
import { sourceUrl } from '../model/filters.ts';
import { Button } from '../../../ui/button.tsx';
import { SHORTLIST_MAX, toggleShortlist } from '../../../lib/shortlist.ts';
import { VenueFacts } from './venue-facts.tsx';
import styles from './catalog.module.css';
const LABELS = { valid: 'בתוקף', expired: 'פג תוקף', undated: 'ללא תאריך סיום', future: 'טרם החל' };
/** Pool and field on the first line; validity, review state and the source on the second. */
function MembershipLine({ member, today }: { member: Membership; today: string }) {
  const source = sourceUrl(member.source);
  const details = [LABELS[validity(member, today)], ...membershipState(member)];
  return (
    <li>
      <span className={styles.pool}>
        <span className={styles.dot} aria-hidden="true" />
        {[member.registry, member.field].filter(Boolean).join(' · ')}
      </span>
      <span className={styles.memberMeta}>
        {details.join(' · ')}
        {source && (
          <>
            {' · '}
            <a href={source} target="_blank" rel="noopener noreferrer">
              פתיחת המקור{member.page ? ` · עמוד ${String(member.page)}` : ''}
            </a>
          </>
        )}
      </span>
    </li>
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
        <ul className={styles.members} aria-label="מאגרים">
          {supplier.memberships.map((member, index) => (
            <MembershipLine key={index} member={member} today={today} />
          ))}
        </ul>
        <VenueFacts venue={supplier.venue} />
        <footer className={styles.cardFoot}>
          <span className={styles.contact}>{contactSummary(supplier.contactKinds)}</span>
          <PickButton supplier={supplier} picked={picked} />
        </footer>
      </article>
    </li>
  );
}
