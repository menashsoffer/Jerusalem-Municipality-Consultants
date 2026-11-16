import { useLoaderData } from 'react-router';
import { Button } from '../../ui/button.tsx';
import { EmptyState } from '../../ui/empty-state.tsx';
import { StatusMessage } from '../../ui/status-message.tsx';
import { getAdminSession, getBootMessage, identity } from '../../data/rpc.ts';
import { LoginForm } from './components/login-form.tsx';
import { GoogleLogin } from './components/google-login.tsx';
import { signOut } from './api/session.ts';
import { ACCESS_MESSAGES, ROLE_LABELS } from './model/access-policy.ts';
export async function loader() {
  return getAdminSession() ? await identity() : null;
}
export function AuthPage() {
  const who = useLoaderData<typeof loader>();
  const message = getBootMessage();
  return (
    <>
      <h1 tabIndex={-1}>כניסה והרשאות</h1>
      {message && <p role="alert">{message}</p>}
      {who ? (
        <>
          <StatusMessage>{ACCESS_MESSAGES[who.access.state]}</StatusMessage>
          {who.access.state === 'active' && (
            <p>
              תפקידים:{' '}
              {who.access.grants.map((g) => ROLE_LABELS[g.role]).join(' · ') || 'אין הרשאה פעילה'}
            </p>
          )}
          <form action={signOut}>
            <Button type="submit">יציאה מהמערכת</Button>
          </form>
        </>
      ) : (
        <>
          <EmptyState title="יש להתחבר כדי להמשיך">
            <p>הכניסה מיועדת למשתמשים שאושרו במערכת.</p>
          </EmptyState>
          <LoginForm />
          <GoogleLogin />
        </>
      )}
    </>
  );
}
