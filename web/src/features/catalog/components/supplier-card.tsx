import { Link } from 'react-router';
import { type Supplier, type Membership, validity } from '../../../catalog-model.ts';
import {
  contactSummary,
  inactiveLine,
  membershipState,
  supplierBadges,
} from '../model/card-labels.ts';
import { sourceUrl } from '../model/filters.ts';
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
}
export function SupplierCard({ supplier, today, deferred }: Props) {
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
        {supplier.inactive && <p role="note">{inactiveLine(supplier.inactive)}</p>}
        {supplier.memberships.map((member, index) => (
          <MembershipLine key={index} member={member} today={today} />
        ))}
        <p>{contactSummary(supplier.contactKinds)}</p>
        <Link
          to={`/supplier/${encodeURIComponent(supplier.id)}`}
          aria-label={`פרטי ספק: ${supplier.name}`}
        >
          פרטי ספק
        </Link>
      </article>
    </li>
  );
}
