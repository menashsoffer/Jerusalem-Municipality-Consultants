import { useErrorReport } from './use-error-report.ts';
import { Link, isRouteErrorResponse, useRouteError, useRevalidator } from 'react-router';
import { DataError } from '../data/client.ts';
import { Button } from '../ui/button.tsx';
import controls from '../ui/control.module.css';
export function ScreenError() {
  const error = useRouteError();
  useErrorReport(error, 'route');
  const revalidator = useRevalidator();
  const status = error instanceof DataError || isRouteErrorResponse(error) ? error.status : 0;
  const title =
    status === 401
      ? 'פג תוקף ההתחברות'
      : status === 403
        ? 'אין הרשאה למסך'
        : status === 404
          ? 'הדף לא נמצא'
          : 'משהו השתבש';
  const message =
    status === 401
      ? 'יש להתחבר מחדש כדי להמשיך.'
      : status === 403
        ? 'המסך זמין רק למשתמשים עם תפקיד מתאים.'
        : 'לא ניתן להציג את המסך. אפשר לנסות שוב.';
  return (
    <section role="alert" className="shell-notice">
      <h1 tabIndex={-1}>{title}</h1>
      <p>{message}</p>
      {status === 401 ? (
        <Link to="/auth" className={controls.button}>
          כניסה למערכת
        </Link>
      ) : (
        <Button
          onClick={() => {
            void revalidator.revalidate();
          }}
        >
          נסו שוב
        </Button>
      )}
    </section>
  );
}
