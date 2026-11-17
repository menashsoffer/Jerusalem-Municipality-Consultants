import { useErrorReport } from './use-error-report.ts';
import {
  Navigate,
  isRouteErrorResponse,
  useLocation,
  useRouteError,
  useRevalidator,
} from 'react-router';
import { getAdminSession } from '../data/rpc.ts';
import { signInPath } from './session-watch.ts';
import { DataError } from '../data/client.ts';
import { Button } from '../ui/button.tsx';
export function ScreenError() {
  const error = useRouteError();
  useErrorReport(error, 'route');
  const revalidator = useRevalidator();
  const location = useLocation();
  const status = error instanceof DataError || isRouteErrorResponse(error) ? error.status : 0;
  // Signed out or never signed in: show the sign-in screen, never an empty page.
  if (status === 401 && !getAdminSession()) return <Navigate to={signInPath(location)} replace />;
  const title =
    status === 401
      ? 'החיבור חודש'
      : status === 403
        ? 'אין הרשאה למסך'
        : status === 404
          ? 'הדף לא נמצא'
          : 'משהו השתבש';
  const message =
    status === 401
      ? 'יש לנסות שוב כדי לטעון את המסך.'
      : status === 403
        ? 'המסך זמין רק למשתמשים עם תפקיד מתאים.'
        : 'לא ניתן להציג את המסך. אפשר לנסות שוב.';
  return (
    <section role="alert" className="shell-notice">
      <h1 tabIndex={-1}>{title}</h1>
      <p>{message}</p>
      <Button
        onClick={() => {
          void revalidator.revalidate();
        }}
      >
        נסו שוב
      </Button>
    </section>
  );
}
