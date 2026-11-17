import { useEffect, useRef } from 'react';
import { Outlet, useLocation, useMatches } from 'react-router';

import type { RouteHandle } from './routes.tsx';
import { SiteHeader } from './site-header.tsx';

const SITE_NAME = 'איתור ספקים';

function isRouteHandle(value: unknown): value is RouteHandle {
  return typeof value === 'object' && value !== null && 'title' in value;
}

/** The title of the deepest route that names one. */
function useRouteTitle(): string {
  const titles = useMatches()
    .map((match) => match.handle)
    .filter(isRouteHandle)
    .map((handle) => handle.title);
  return titles.at(-1) ?? SITE_NAME;
}

/** Shared frame: skip link, header, one main region. Moves focus to the new screen's h1. */
export function Layout() {
  const title = useRouteTitle();
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    document.title = `${title} | ${SITE_NAME}`;
  }, [title]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    main.current?.querySelector<HTMLElement>('h1')?.focus();
  }, [pathname]);

  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          main.current?.querySelector<HTMLElement>('h1')?.focus();
        }}
      >
        דילוג לתוכן
      </a>
      <SiteHeader />
      <main id="main" ref={main} className="shell-main" tabIndex={-1}>
        <Outlet />
      </main>
    </>
  );
}
