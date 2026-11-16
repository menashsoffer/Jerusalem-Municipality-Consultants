// Entry of the admin page, the first React page (work plan, stage A). The catalog page keeps
// its own entry (main.ts) until task R12 merges both into one.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { AppRouter, createAdminRouter } from './app-shell/router.tsx';
import { prepareAdmin } from './features/auth/api/bootstrap.ts';
import { Skeleton } from './ui/skeleton.tsx';
import { setAdminSession } from './data/rpc.ts';
import './styles/layers.css';
import './styles/tokens.css';
import './styles/base.css';
import './app-shell/shell.css';

const root = document.getElementById('root');
if (!root) throw new Error('The page has no #root element.');

const mounted = createRoot(root);
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
} catch {
  mounted.render(<p role="alert">לא ניתן לפתוח את דף הניהול. יש לטעון מחדש ולנסות שוב.</p>);
}
