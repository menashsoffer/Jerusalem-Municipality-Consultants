import { dayOf } from '../../../lib/dates.ts';
import type { SupplierFile } from '../api/portal.ts';
import { CONTACT_LABELS, SCHEME_LABELS, validity } from '../model/portal-model.ts';
import styles from './area.module.css';

const UNTIL: Record<ReturnType<typeof validity>, (until: string) => string> = {
  open: () => 'בלי תאריך סיום',
  valid: (until) => `בתוקף עד ${dayOf(until)}`,
  soon: (until) => `מסתיים ב-${dayOf(until)}`,
  ended: (until) => `הסתיים ב-${dayOf(until)}`,
};

function Details({ file }: { file: SupplierFile }) {
  return (
    <section className={styles.panel} aria-labelledby="details-title">
      <h2 id="details-title">הפרטים שלי</h2>
      <dl className={styles.facts}>
        {file.other_names.length > 0 && (
          <div>
            <dt>שמות נוספים</dt>
            <dd>{file.other_names.join(', ')}</dd>
          </div>
        )}
        {file.identifiers.map((id) => (
          <div key={`${id.scheme}-${id.value}`}>
            <dt>{SCHEME_LABELS[id.scheme] ?? id.scheme}</dt>
            <dd>
              <bdi>{id.value}</bdi> · {id.verified ? 'מאומת' : 'בבדיקה'}
            </dd>
          </div>
        ))}
        {file.contacts.map((c) => (
          <div key={`${c.kind}-${c.value}`}>
            <dt>{CONTACT_LABELS[c.kind] ?? c.kind}</dt>
            <dd>
              <bdi>{c.value}</bdi>
            </dd>
          </div>
        ))}
      </dl>
      <p className={styles.muted}>
        פרט שגוי? בקרוב אפשר יהיה להציע תיקון מכאן. בינתיים פנו ליחידה שאיתה אתם עובדים.
      </p>
    </section>
  );
}

function Memberships({ file, today }: { file: SupplierFile; today: string }) {
  return (
    <section className={styles.panel} aria-labelledby="registries-title">
      <h2 id="registries-title">המאגרים שלי</h2>
      {file.memberships.length === 0 ? (
        <p>הספק לא רשום כרגע באף מאגר של העירייה.</p>
      ) : (
        <ul className={styles.list}>
          {file.memberships.map((m) => {
            const state = validity(m.registered_until, today);
            return (
              <li key={`${m.registry}-${m.field ?? ''}`} data-state={state}>
                <strong>{m.registry}</strong>
                {m.field && <span> · {m.field}</span>}
                {m.unit && <span className={styles.muted}> · {m.unit}</span>}
                <span className={styles.until}>{UNTIL[state](m.registered_until ?? '')}</span>
                {m.document_url && (
                  <a href={m.document_url} target="_blank" rel="noreferrer">
                    מסמך המאגר
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** "התיק שלי" (spec 6.3): how the municipality sees the supplier, read only in stage 1. */
export function MyFile({ file, today }: { file: SupplierFile; today: string }) {
  return (
    <>
      <header className={styles.title}>
        <h1 tabIndex={-1}>{file.name}</h1>
        <p className={styles.muted}>{file.role === 'owner' ? 'מורשה ספק' : 'עובד ספק'}</p>
      </header>
      <Details file={file} />
      <Memberships file={file} today={today} />
    </>
  );
}
