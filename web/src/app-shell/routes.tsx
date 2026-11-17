import type { RouteObject } from 'react-router';

import { Layout } from './layout.tsx';
import { ScreenError } from './screen-error.tsx';
import { Skeleton } from '../ui/skeleton.tsx';
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
    hydrateFallbackElement: <Skeleton />,
    children: [
      {
        path: 'catalog',
        handle: { title: 'איתור ספקים' },
        errorElement: <ScreenError />,
        lazy: async () => {
          const m = await import('../features/catalog/catalog-page.tsx');
          return { Component: m.CatalogPage, loader: m.loader };
        },
      },
      {
        path: 'categories',
        handle: { title: 'בקשות קטגוריה' },
        errorElement: <ScreenError />,
        lazy: async () => {
          const m = await import('../features/categories/categories-page.tsx');
          return { Component: m.CategoriesPage, loader: m.loader };
        },
      },
      {
        path: 'identifiers',
        handle: { title: 'מועמדי מזהה ספק' },
        errorElement: <ScreenError />,
        lazy: async () => {
          const m = await import('../features/identifiers/identifiers-page.tsx');
          return { Component: m.IdentifiersPage, loader: m.loader };
        },
      },
      {
        index: true,
        handle: { title: 'ניהול' } satisfies RouteHandle,
        lazy: async () => ({ Component: (await import('./home-page.tsx')).HomePage }),
      },
      {
        path: 'route-check',
        handle: { title: 'בדיקת מסלול ההתקשרות' },
        errorElement: <ScreenError />,
        lazy: async () => {
          const m = await import('../features/route-check/route-check-page.tsx');
          return { Component: m.RouteCheckPage, loader: m.loader };
        },
      },
      {
        path: 'users',
        handle: { title: 'משתמשים ותפקידים' },
        errorElement: <ScreenError />,
        lazy: async () => {
          const m = await import('../features/users/users-page.tsx');
          return { Component: m.UsersPage, loader: m.loader };
        },
      },
      {
        path: 'thresholds',
        handle: { title: 'אישור הסף החודשי' },
        errorElement: <ScreenError />,
        lazy: async () => {
          const m = await import('../features/thresholds/thresholds-page.tsx');
          return { Component: m.ThresholdsPage, loader: m.loader };
        },
      },
      {
        path: 'auth',
        handle: { title: 'כניסה והרשאות' },
        errorElement: <ScreenError />,
        lazy: async () => {
          const m = await import('../features/auth/auth-page.tsx');
          return { Component: m.AuthPage, loader: m.loader };
        },
      },
      {
        path: '*',
        handle: { title: 'הדף לא נמצא' } satisfies RouteHandle,
        lazy: async () => ({ Component: (await import('./not-found-page.tsx')).NotFoundPage }),
      },
    ],
  },
];
