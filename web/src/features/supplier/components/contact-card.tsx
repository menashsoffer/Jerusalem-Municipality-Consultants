import type { SupplierDetail } from '../../../data/supplier-detail.ts';
import { contactLink } from '../model/contact-links.ts';
import { CONTACT_KINDS } from '../model/labels.ts';
import { Icon, type IconName } from '../../../ui/icon.tsx';
import { CopyButton } from './copy-button.tsx';
import styles from './supplier.module.css';

type Contact = SupplierDetail['contacts'][number];
const ORDER = ['phone', 'email', 'address', 'website', 'contact_person'];
const ICONS: Record<string, IconName> = {
  phone: 'phone',
  email: 'mail',
  address: 'pin',
  website: 'globe',
  contact_person: 'person',
};

/** Spec 4.6: an address that the map did not find stays visible, with a note. */
function unmapped(item: Contact): boolean {
  return item.map?.result === 'not_found' || item.map?.result === 'approximate';
}

function Value({ item }: { item: Contact }) {
  const link = contactLink(item.kind, item.value);
  const value = <bdi>{item.value}</bdi>;
  if (!link) return value;
  // An address opens in Google Maps, like a website opens in a new tab (Menash, 18.11).
  const external = item.kind === 'website' || item.kind === 'address';
  return (
    <a href={link} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {value}
    </a>
  );
}

/** Spec section 4.3: each detail on its own line, clickable, with a copy button. */
export function ContactCard({ contacts }: { contacts: SupplierDetail['contacts'] }) {
  const sorted = [...contacts].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
  const hasPhone = contacts.some((item) => item.kind === 'phone');
  return (
    <section className={styles.card} aria-labelledby="supplier-contact">
      <h2 id="supplier-contact">יצירת קשר</h2>
      <ul className={styles.contacts}>
        {sorted.map((item) => (
          <li key={item.id}>
            <span className={styles.kind}>
              <Icon name={ICONS[item.kind] ?? 'person'} />
              <span className={styles.visuallyHidden}>{CONTACT_KINDS[item.kind] ?? 'פרט קשר'}</span>
            </span>
            <span className={styles.value}>
              <Value item={item} />
              {item.is_valid === false && <span className={styles.warn}>ייתכן שאינו תקין</span>}
              {unmapped(item) && <span className={styles.warn}>הכתובת לא אותרה במפה</span>}
            </span>
            <CopyButton value={item.value} label={CONTACT_KINDS[item.kind] ?? 'פרט הקשר'} />
          </li>
        ))}
        {!hasPhone && (
          <li className={styles.missing}>
            <span className={styles.kind}>
              <Icon name="phone" />
            </span>
            <span className={styles.value}>אין טלפון במאגר</span>
          </li>
        )}
      </ul>
    </section>
  );
}
