// Entry of the site: one React page for the catalog, supplier screens and admin screens.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { AppRouter, createAdminRouter } from './app-shell/router.tsx';
import { prepareAdmin } from './features/auth/api/bootstrap.ts';
import { PageLoader } from './ui/logo-dots.tsx';
import { setAdminSession, getAdminSession, installKeeper } from './data/rpc.ts';
import { browserKeeper, endedStart, watchSession } from './app-shell/session-watch.ts';
import { getAccess, telemetryRequest } from './data/site.ts';
import { EventBatcher } from './lib/tracker.ts';
import { observeVitals } from './lib/vitals.ts';
import { setTelemetryReporter, reportBoundaryError } from './lib/telemetry.ts';
import type { TelemetryEvent } from './lib/vitals-model.ts';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/select.css';
import './app-shell/shell.css';

const root = document.getElementById('root');
if (!root) throw new Error('The page has no #root element.');

const batcher = new EventBatcher<TelemetryEvent>(window, (events) => {
  const session = getAdminSession(),
    access = getAccess();
  return session && session.exp > Date.now() && access?.member && access.state === 'active'
    ? telemetryRequest(session.token, events)
    : null;
});
setTelemetryReporter((event) => {
  batcher.add(event);
});
observeVitals(
  window,
  (event) => {
    batcher.add(event);
  },
  {
    flush: () => {
      batcher.flush();
    },
  },
);
const mounted = createRoot(root, {
  onUncaughtError: (error) => {
    reportBoundaryError(error, 'root');
  },
});
mounted.render(<PageLoader label="טוען את האתר…" />);
try {
  const keeper = browserKeeper();
  installKeeper(keeper);
  const initialized = await prepareAdmin({
    location: window.location,
    history: window.history,
    storage: window.localStorage,
  });
  setAdminSession(initialized.session, initialized.message);
  // A browser opened after the access token expired renews it before any screen loads.
  const renewed = await keeper.fresh().catch(() => keeper.current());
  const ended = initialized.session !== null && renewed === null;
  const start = ended ? endedStart(window.location.hash) : initialized.next;
  if (start) window.history.replaceState(null, '', `#${start}`);
  const router = createAdminRouter();
  watchSession(keeper, router);
  mounted.render(
    <StrictMode>
      <AppRouter router={router} />
    </StrictMode>,
  );
} catch (error) {
  reportBoundaryError(error, 'bootstrap');
  mounted.render(<p role="alert">לא ניתן לפתוח את האתר. יש לטעון מחדש ולנסות שוב.</p>);
}
