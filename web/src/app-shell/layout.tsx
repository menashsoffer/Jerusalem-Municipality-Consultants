import { useEffect, useRef } from 'react';
import { Outlet, useLocation, useMatches, useNavigation, useRevalidator } from 'react-router';

import type { RouteHandle } from './routes.tsx';
import { SiteHeader } from './site-header.tsx';
import { OfflineBanner } from './offline-banner.tsx';

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

/**
 * While the next screen loads: a bar in the logo colors under the header, and the current screen
 * fades, so a press never looks ignored (DESIGN.md 6.8). Both wait a moment before showing, so a
 * quick move does not flash.
 */
function NavigationProgress() {
  const moving = useNavigation().state !== 'idle';
  // A screen that reloads its data after a change (approve, grant, remove) also shows the bar.
  const reloading = useRevalidator().state !== 'idle';
  const busy = moving || reloading;
  return (
    <div className="shell-progress-slot">
      {busy && <progress className="shell-progress" aria-label="טוען את המסך" />}
    </div>
  );
}

/** Shared frame: skip link, header, one main region. Moves focus to the new screen's h1. */
export function Layout() {
  const title = useRouteTitle();
  const busy = useNavigation().state === 'loading';
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
      <NavigationProgress />
      <OfflineBanner />
      <main
        id="main"
        ref={main}
        className="shell-main"
        tabIndex={-1}
        data-pending={busy || undefined}
      >
        <Outlet />
      </main>
    </>
  );
}
