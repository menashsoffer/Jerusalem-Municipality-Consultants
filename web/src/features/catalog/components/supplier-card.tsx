import { Link } from 'react-router';
import { type Supplier, type Membership, validity } from '../../../catalog-model.ts';
import { sourceUrl } from '../model/filters.ts';
import styles from './catalog.module.css';
const LABELS = { valid: 'בתוקף', expired: 'פג תוקף', undated: 'ללא תאריך סיום', future: 'טרם החל' };
function MembershipLine({ member, today }: { member: Membership; today: string }) {
  const source = sourceUrl(member.source);
  return (
    <p>
      {[member.registry, member.field, LABELS[validity(member, today)]].filter(Boolean).join(' · ')}
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
        <p>{supplier.verified ? 'ספק מאומת' : 'ספק לא מאומת'}</p>
        {supplier.memberships.map((member, index) => (
          <MembershipLine key={index} member={member} today={today} />
        ))}
        {supplier.contacts
          .filter((c) => c.kind === 'phone' || c.kind === 'email')
          .map((contact, index) => (
            <p key={index}>
              {contact.kind === 'phone' ? 'טלפון' : 'דוא״ל'}: <bdi dir="ltr">{contact.value}</bdi>
              {contact.valid === false ? ' (לא תקין)' : ''}
            </p>
          ))}
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
