// Entry of the admin page, the first React page (work plan, stage A). The catalog page keeps
// its own entry (main.ts) until task R12 merges both into one.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { AppRouter } from './app-shell/router.tsx';
import './styles/layers.css';
import './styles/tokens.css';
import './styles/base.css';
import './app-shell/shell.css';

const root = document.getElementById('root');
if (!root) throw new Error('The page has no #root element.');

createRoot(root).render(
  <StrictMode>
    <AppRouter />
  </StrictMode>,
);
