import type { RouteObject } from 'react-router';

import { Layout } from './layout.tsx';
import { RouteError } from './route-error.tsx';

/** Page title shown in the tab; every route sets one so screen readers announce the change. */
export interface RouteHandle {
  title: string;
}

/**
 * The route table. Each screen loads lazily, so a visitor downloads only the screen they open.
 * A feature adds exactly one entry here for its own route (work plan, section 3).
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    errorElement: <RouteError />,
    // Shown while the first lazily loaded screen arrives.
    hydrateFallbackElement: <p role="status">טוען...</p>,
    children: [
      {
        index: true,
        handle: { title: 'ניהול' } satisfies RouteHandle,
        lazy: async () => ({ Component: (await import('./home-page.tsx')).HomePage }),
      },
      {
        path: '*',
        handle: { title: 'הדף לא נמצא' } satisfies RouteHandle,
        lazy: async () => ({ Component: (await import('./not-found-page.tsx')).NotFoundPage }),
      },
    ],
  },
];
