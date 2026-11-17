import { redirect, useLoaderData, type LoaderFunctionArgs } from 'react-router';
import { Button } from '../../ui/button.tsx';
import { StatusMessage } from '../../ui/status-message.tsx';
import { getAdminSession, getBootMessage, identity, type Identity } from '../../data/rpc.ts';
import { safePath } from '../../data/session.ts';
import { LoginForm } from './components/login-form.tsx';
import { GoogleLogin } from './components/google-login.tsx';
import { signOut } from './api/session.ts';
import { ACCESS_MESSAGES, ROLE_LABELS } from './model/access-policy.ts';
import styles from './components/auth.module.css';
export const EXPIRED_NOTICE = 'ההתחברות הסתיימה. יש להתחבר שוב, ואחרי הכניסה נחזור למסך הקודם.';
/** A signed-in user who was sent here on the way to another screen goes straight back. */
interface AuthData {
  who: Identity | null;
  expired: boolean;
}
export async function loader({ request }: LoaderFunctionArgs): Promise<AuthData | Response> {
  const params = new URL(request.url).searchParams;
  const who = getAdminSession() ? await identity() : null;
  const next = safePath(params.get('next'));
  if (who?.access.state === 'active' && next) return redirect(next);
  return { who, expired: !who && params.get('reason') === 'expired' };
}
type Who = AuthData['who'];
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
  const { who, expired } = useLoaderData<AuthData>();
  const message = getBootMessage() || (expired ? EXPIRED_NOTICE : '');
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
