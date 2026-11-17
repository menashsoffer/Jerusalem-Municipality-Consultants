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
function MembershipLine({ member, today }: { member: Membership; today: string }) {
  const source = sourceUrl(member.source);
  return (
    <p>
      {[member.registry, member.field, LABELS[validity(member, today)], ...membershipState(member)]
        .filter(Boolean)
        .join(' · ')}
      {source && (
        <>
          {' '}
          ·{' '}
          <a href={source} target="_blank" rel="noopener noreferrer">
            פתיחת המקור{member.page ? ` · עמוד ${String(member.page)}` : ''}
          </a>
        </>
      )}
    </p>
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
    return <Button disabled>הבקשה מלאה ({String(SHORTLIST_MAX)} ספקים)</Button>;
  }
  if (supplier.inactive && !picked) {
    return (
      <Button disabled aria-describedby={`inactive-${supplier.id}`}>
        הוספה לבקשת התקשרות
      </Button>
    );
  }
  return (
    <Button
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
    <li className={deferred ? styles.deferred : undefined}>
      <article className={styles.card}>
        <h3>{supplier.name}</h3>
        <ul className={styles.badges} aria-label="מצב הספק">
          {supplierBadges(supplier).map((badge) => (
            <li key={badge.text} className={[styles.badge, styles[badge.tone]].join(' ')}>
              {badge.text}
            </li>
          ))}
        </ul>
        {supplier.inactive && (
          <p role="note" id={`inactive-${supplier.id}`}>
            {inactiveLine(supplier.inactive)}
          </p>
        )}
        <VenueFacts venue={supplier.venue} />
        {supplier.memberships.map((member, index) => (
          <MembershipLine key={index} member={member} today={today} />
        ))}
        <p>{contactSummary(supplier.contactKinds)}</p>
        <Link
          to={`/supplier/${encodeURIComponent(supplier.id)}`}
          aria-label={`פרטי ספק: ${supplier.name}`}
        >
          פרטי ספק
        </Link>{' '}
        <PickButton supplier={supplier} picked={picked} />
      </article>
    </li>
  );
}
