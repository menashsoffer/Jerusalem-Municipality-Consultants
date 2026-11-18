import { useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '../../../ui/button.tsx';
import { Notice } from '../../../ui/notice.tsx';
import { PageHeader } from '../../../ui/page-header.tsx';
import type { Account } from '../api/account.ts';
import { signOut } from '../api/session.ts';
import { MyDetails } from './my-details.tsx';
import { CHANGE_DIALOG, MyRoles } from './my-roles.tsx';
import styles from './account.module.css';

/** The user-menu links land here: `?part=details` opens the form, `?part=roles` the dialog. */
function usePart(ready: boolean) {
  const [params] = useSearchParams();
  const part = params.get('part');
  useEffect(() => {
    if (part !== 'roles' || !ready) return;
    const dialog = document.getElementById(CHANGE_DIALOG);
    if (dialog instanceof HTMLDialogElement && !dialog.open) dialog.showModal();
  }, [part, ready]);
  return part;
}

/** An active user's "החשבון שלי" (screens-spec 4 and 4.1). */
export function MyAccount({ account }: { account: Account }) {
  const { profile, units, grants, changes } = account;
  const part = usePart(changes !== null);
  const unit = units.find((u) => u.id === profile?.unit_id)?.name ?? 'לא נקבעה';
  return (
    <div className={styles.page}>
      <PageHeader
        title="החשבון שלי"
        lead="הפרטים והתפקידים שלך במערכת. שינוי נשלח לאישור מנהל."
        action={
          <form action={signOut}>
            <Button type="submit" variant="secondary">
              יציאה מהמערכת
            </Button>
          </form>
        }
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
          startEditing={part === 'details'}
        />
      )}
      <MyRoles units={units} grants={grants} changes={changes} />
    </div>
  );
}
