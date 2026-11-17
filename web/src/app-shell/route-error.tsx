import { useErrorReport } from './use-error-report.ts';
import { isRouteErrorResponse, useRouteError } from 'react-router';

const NOT_FOUND = 404;

/** Shown instead of a screen that failed, so one broken screen never takes down the page. */
export function RouteError() {
  const error = useRouteError();
  useErrorReport(error, 'root');
  const missing = isRouteErrorResponse(error) && error.status === NOT_FOUND;
  return (
    <main className="shell-main">
      <section className="notice" role="alert">
        <h1 tabIndex={-1}>{missing ? 'הדף לא נמצא' : 'משהו השתבש'}</h1>
        <p>
          {missing
            ? 'הכתובת אינה קיימת במסכי הניהול.'
            : 'לא ניתן להציג את המסך. נסו לטעון אותו מחדש.'}
        </p>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            window.location.reload();
          }}
        >
          טעינה מחדש
        </button>
      </section>
    </main>
  );
}
