import { createHashRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';

import { routes } from './routes.tsx';

// Hash history: GitHub Pages does not serve index.html for deep paths (decision 0006).
const router = createHashRouter(routes);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
