import { redirect, useLoaderData } from 'react-router';
import { getAdminSession } from '../../data/rpc.ts';
import { israelToday } from '../../lib/dates.ts';
import { loadFile, loadMe, type PortalMe, type SupplierFile } from './api/portal.ts';
import { activeAccounts, areaStep, type AreaStep } from './model/portal-model.ts';
import { AccountNotes } from './components/account-notes.tsx';
import { Invites } from './components/invites.tsx';
import { LinkWizard } from './components/link-wizard.tsx';
import { MyFile } from './components/my-file.tsx';
import { PersonForm } from './components/person-form.tsx';
import styles from './components/area.module.css';

export const LOGIN_PATH = '/supplier-area/login?next=%2Fsupplier-area';

interface AreaData {
  me: PortalMe;
  step: AreaStep;
  file: SupplierFile | null;
  today: string;
}

/** Signed out goes to the supplier sign-in; signed in loads the person and their supplier. */
export async function loader(): Promise<AreaData | Response> {
  if (!getAdminSession()) return redirect(LOGIN_PATH);
  const me = await loadMe();
  const step = areaStep(me);
  const first = activeAccounts(me)[0];
  const file = step === 'file' && first ? await loadFile(first.supplier_id) : null;
  return { me, step, file, today: israelToday() };
}

function Start({ me, step }: { me: PortalMe; step: AreaStep }) {
  return (
    <>
      <header className={styles.title}>
        <h1 tabIndex={-1}>האזור האישי לספקים</h1>
        <p className={styles.muted}>נכנסתם בתור {me.email}</p>
      </header>
      <AccountNotes accounts={me.accounts} />
      {step === 'person' && <PersonForm person={me.person} />}
      {step === 'invites' && <Invites invites={me.invites} />}
      {step !== 'person' && !me.accounts.some((a) => a.status === 'pending') && <LinkWizard />}
    </>
  );
}

export function SupplierAreaPage() {
  const { me, step, file, today } = useLoaderData<AreaData>();
  return (
    <div className={styles.area}>
      {file ? <MyFile file={file} today={today} /> : <Start me={me} step={step} />}
    </div>
  );
}
