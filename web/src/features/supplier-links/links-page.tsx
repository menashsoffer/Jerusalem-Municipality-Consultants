import { useLoaderData } from 'react-router';
import { EmptyState } from '../../ui/empty-state.tsx';
import { PageHeader } from '../../ui/page-header.tsx';
import { getScreenData } from '../../data/screen-data.ts';
import { useScreenData } from '../../data/react-screen-data.ts';
import { loadLinks, SUPPLIER_LINKS_KEY, type SupplierLink } from './api/links.ts';
import { LinkRow } from './components/link-row.tsx';
import styles from './components/links.module.css';

export const loader = () => getScreenData(SUPPLIER_LINKS_KEY, loadLinks);

function Group({ title, links }: { title: string; links: SupplierLink[] }) {
  if (links.length === 0) return null;
  return (
    <section aria-label={title}>
      <h2>{`${title} (${String(links.length)})`}</h2>
      <ul className={styles.list}>
        {links.map((link) => (
          <LinkRow key={link.id} link={link} />
        ))}
      </ul>
    </section>
  );
}

/** Waiting links and the last week's email matches (supplier-portal-spec-he.md 6.10). */
export function SupplierLinksPage() {
  const links = useScreenData(SUPPLIER_LINKS_KEY, useLoaderData<typeof loader>(), loadLinks).value;
  return (
    <div className={styles.page}>
      <PageHeader
        title="שיוכים לאזור האישי"
        lead="מי ביקש להיכנס בשם ספק. שיוך בהתאמת דוא״ל נכנס מיד, ומופיע כאן שבוע כדי לבדוק אותו."
        back={{ to: '/admin', label: 'ניהול' }}
      />
      {links.length === 0 ? (
        <EmptyState title="אין שיוכים לבדיקה">
          <p>כשספק יבקש להיכנס לאזור האישי, הבקשה תופיע כאן.</p>
        </EmptyState>
      ) : (
        <>
          <Group title="ממתינים לאישור" links={links.filter((l) => l.status === 'pending')} />
          <Group
            title="נכנסו בהתאמת דוא״ל השבוע"
            links={links.filter((l) => l.status === 'active')}
          />
        </>
      )}
    </div>
  );
}
