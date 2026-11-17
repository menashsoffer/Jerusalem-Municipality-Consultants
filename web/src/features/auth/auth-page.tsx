import { useLoaderData } from 'react-router';
import { Button } from '../../ui/button.tsx';
import { StatusMessage } from '../../ui/status-message.tsx';
import { getAdminSession, getBootMessage, identity } from '../../data/rpc.ts';
import { LoginForm } from './components/login-form.tsx';
import { GoogleLogin } from './components/google-login.tsx';
import { signOut } from './api/session.ts';
import { ACCESS_MESSAGES, ROLE_LABELS } from './model/access-policy.ts';
import styles from './components/auth.module.css';
export async function loader() {
  return getAdminSession() ? await identity() : null;
}
type Who = Awaited<ReturnType<typeof loader>>;
function SignedIn({ who }: { who: NonNullable<Who> }) {
  return (
    <>
      <StatusMessage>{ACCESS_MESSAGES[who.access.state]}</StatusMessage>
      {who.access.state === 'active' && (
        <p className={styles.roles}>
          תפקידים:{' '}
          {who.access.grants.map((g) => ROLE_LABELS[g.role]).join(' · ') || 'אין הרשאה פעילה'}
        </p>
      )}
      <form action={signOut}>
        <Button type="submit" variant="secondary">
          יציאה מהמערכת
        </Button>
      </form>
    </>
  );
}
export function AuthPage() {
  const who = useLoaderData<typeof loader>();
  const message = getBootMessage();
  return (
    <section className={styles.card}>
      <span className={styles.dots} aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <h1 tabIndex={-1}>כניסה והרשאות</h1>
      {message && <p role="alert">{message}</p>}
      {who ? (
        <SignedIn who={who} />
      ) : (
        <>
          <p className={styles.lead}>הכניסה מיועדת לעובדי העירייה שאושרו במערכת.</p>
          <GoogleLogin />
          <p className={styles.divider}>או בקישור לדוא״ל</p>
          <LoginForm />
        </>
      )}
    </section>
  );
}
