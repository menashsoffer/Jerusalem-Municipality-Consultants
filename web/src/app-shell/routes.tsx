import { Navigate, type RouteObject } from 'react-router';

import { Layout } from './layout.tsx';
import { ScreenError } from './screen-error.tsx';
import { Skeleton } from '../ui/skeleton.tsx';
import { RouteError } from './route-error.tsx';
import { getAdminSession, identity } from '../data/rpc.ts';

function prefetchAccess(): null {
  if (getAdminSession()) void identity().catch(() => undefined);
  return null;
}

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
    // Starts loading who the user is on any first screen, so the top bar shows the right tabs.
    loader: prefetchAccess,
    shouldRevalidate: () => false,
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
        path: 'supplier/new',
        handle: { title: 'הוספת ספק' },
        errorElement: <ScreenError />,
        lazy: async () => {
          const m = await import('../features/supplier/add-page.tsx');
          return { Component: m.AddSupplierPage, loader: m.loader };
        },
      },
      {
        path: 'supplier/:id',
        handle: { title: 'פרטי ספק' },
        errorElement: <ScreenError />,
        lazy: async () => {
          const m = await import('../features/supplier/supplier-page.tsx');
          return { Component: m.SupplierPage, loader: m.loader };
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
      // The catalog is the site's main screen; the admin menu has its own address.
      { index: true, element: <Navigate to="/catalog" replace /> },
      {
        path: 'admin',
        handle: { title: 'ניהול' } satisfies RouteHandle,
        errorElement: <ScreenError />,
        lazy: async () => {
          const m = await import('./home-page.tsx');
          return { Component: m.HomePage, loader: m.loader };
        },
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
        path: 'engagement',
        handle: { title: 'בקשת התקשרות' },
        errorElement: <ScreenError />,
        lazy: async () => {
          const m = await import('../features/route-check/engagement-page.tsx');
          return { Component: m.EngagementPage, loader: m.loader };
        },
      },
      {
        path: 'addresses',
        handle: { title: 'כתובות לבדיקה' },
        errorElement: <ScreenError />,
        lazy: async () => {
          const m = await import('../features/addresses/addresses-page.tsx');
          return { Component: m.AddressesPage, loader: m.loader };
        },
      },
      {
        path: 'load-control',
        handle: { title: 'בקרת טעינה' },
        errorElement: <ScreenError />,
        lazy: async () => {
          const m = await import('../features/load-control/load-control-page.tsx');
          return { Component: m.LoadControlPage, loader: m.loader };
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
