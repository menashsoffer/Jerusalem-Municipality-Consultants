// Entry of the site: one React page for the catalog, supplier screens and admin screens.
// The layer order must be declared before any other stylesheet, so it is the first import.
import './styles/layers.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { AppRouter, createAdminRouter } from './app-shell/router.tsx';
import { prepareAdmin } from './features/auth/api/bootstrap.ts';
import { Skeleton } from './ui/skeleton.tsx';
import { setAdminSession, getAdminSession } from './data/rpc.ts';
import { getAccess, telemetryRequest } from './data/site.ts';
import { EventBatcher } from './lib/tracker.ts';
import { observeVitals } from './lib/vitals.ts';
import { setTelemetryReporter, reportBoundaryError } from './lib/telemetry.ts';
import type { TelemetryEvent } from './lib/vitals-model.ts';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
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
mounted.render(<Skeleton />);
try {
  const initialized = await prepareAdmin({
    location: window.location,
    history: window.history,
    storage: window.sessionStorage,
  });
  setAdminSession(initialized.session, initialized.message);
  const router = createAdminRouter();
  mounted.render(
    <StrictMode>
      <AppRouter router={router} />
    </StrictMode>,
  );
} catch (error) {
  reportBoundaryError(error, 'bootstrap');
  mounted.render(<p role="alert">לא ניתן לפתוח את האתר. יש לטעון מחדש ולנסות שוב.</p>);
}
