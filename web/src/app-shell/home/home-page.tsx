import { useState, type SyntheticEvent } from 'react';
import { redirect, useLoaderData, useNavigate } from 'react-router';
import { overview as adminOverview } from '../home-page.tsx';
import { allowedScreens } from '../screens.ts';
import { getAdminSession, identity, rpc, type Identity } from '../../data/rpc.ts';
import { Button } from '../../ui/button.tsx';
import { FormField } from '../../ui/form-field.tsx';
import { Notice } from '../../ui/notice.tsx';
import { PageHeader } from '../../ui/page-header.tsx';
import { QuickActions } from './components/quick-actions.tsx';
import { RegistryState } from './components/registry-state.tsx';
import { WaitingList } from './components/waiting-list.tsx';
import { homeSchema, waitingItems, type AdminCounts, type HomeOverview } from './model/overview.ts';
import styles from './home.module.css';

interface HomeData {
  who: Identity;
  home: HomeOverview | null;
  counts: AdminCounts;
}

/** The overview is a convenience: if it cannot be read, the screen shows without it. */
async function homeOverview(): Promise<HomeOverview | null> {
  try {
    return await rpc('home_overview', {}, homeSchema);
  } catch {
    return null;
  }
}

/** Only active staff have a home screen; everyone else goes to the catalog's own explanation. */
export async function loader(): Promise<HomeData | Response> {
  if (!getAdminSession()) return redirect('/catalog');
  const who = await identity();
  if (who.access.state !== 'active' || !(who.access.member || who.access.admin))
    return redirect('/catalog');
  const [home, counts] = await Promise.all([homeOverview(), adminOverview()]);
  return { who, home, counts };
}

function SupplierSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    void navigate('/catalog', { state: { query } });
  };
  return (
    <search>
      <form className={styles.search} onSubmit={submit}>
        <FormField
          field={{ label: 'חיפוש ספק', hint: 'שם ספק, שם קודם או תחום, למשל: הדרכה' }}
          input={{
            type: 'search',
            value: query,
            onChange: (e) => {
              setQuery(e.currentTarget.value);
            },
          }}
        />
        <Button type="submit">חיפוש</Button>
      </form>
    </search>
  );
}

/** The home screen (design approved 25.11.2026): search, what waits for you, the registries. */
export function HomePage() {
  const { who, home, counts } = useLoaderData<HomeData>();
  const items = waitingItems(home, allowedScreens(who.access), counts);
  return (
    <>
      <PageHeader title="בית" lead="חיפוש ספק, ומה מחכה לך היום." />
      <SupplierSearch />
      <div className={styles.columns}>
        <WaitingList items={items} />
        <QuickActions access={who.access} />
      </div>
      {home ? (
        <RegistryState overview={home} />
      ) : (
        <Notice tone="info" title="מצב המאגרים לא נטען.">
          אפשר להמשיך לעבוד. המספרים יופיעו בכניסה הבאה.
        </Notice>
      )}
    </>
  );
}
