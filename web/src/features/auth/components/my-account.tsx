import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Notice } from '../../../ui/notice.tsx';
import { PageHeader } from '../../../ui/page-header.tsx';
import type { Account } from '../api/account.ts';
import { AccountActions } from './account-actions.tsx';
import { MyDetails } from './my-details.tsx';
import { MyRoles } from './my-roles.tsx';
import { ProfileCard } from './profile-card.tsx';
import styles from './account.module.css';

function showDetails() {
  requestAnimationFrame(() => {
    const details = document.getElementById('my-details');
    // jsdom has no scrolling; browsers do.
    if (details && typeof details.scrollIntoView === 'function') details.scrollIntoView();
  });
}

/** An active user's personal area (screens-spec 4 and 4.2): who, actions, details, roles. */
export function MyAccount({ account }: { account: Account }) {
  const { profile, units, grants, changes } = account;
  const [params] = useSearchParams();
  const [editing, setEditing] = useState(params.get('part') === 'details');
  const unit = units.find((u) => u.id === profile?.unit_id)?.name ?? 'לא נקבעה';
  const waiting = changes?.some((c) => c.kind === 'details' && c.status === 'pending');
  return (
    <div className={styles.page}>
      <PageHeader title="האזור האישי" lead="הפרטים והתפקידים שלך במערכת. שינוי נשלח לאישור מנהל." />
      {profile && <ProfileCard profile={profile} unit={unit} account={account} />}
      <AccountActions
        edit={
          changes && profile && !waiting
            ? () => {
                setEditing(true);
                showDetails();
              }
            : null
        }
        askChange={changes !== null}
      />
      {changes === null && (
        <Notice tone="info" title="בקשות שינוי עדיין לא זמינות כאן.">
          לשינוי פרטים או תפקיד פונים בינתיים למנהל המערכת.
        </Notice>
      )}
      {profile && (
        <MyDetails
          profile={profile}
          unit={unit}
          changes={changes}
          editing={editing}
          setEditing={setEditing}
        />
      )}
      <MyRoles units={units} grants={grants} changes={changes} />
    </div>
  );
}
