import { Link, useLocation } from 'react-router';

import { SECTIONS, sectionOf, type Section } from './sections.ts';

// Icon outlines follow Lucide (ISC license): search, clipboard-check, settings-2, user.
const ICONS: Record<Section['key'], string> = {
  catalog: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  requests: 'M9 4h6v3H9zM7 5H5v15h14V5h-2M9 13l2 2 4-4',
  admin: 'M14 17H5M19 7h-9M17 20a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM7 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
};
const USER_ICON = 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z';

function Icon({ path }: { path: string }) {
  return (
    <svg className="shell-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={path} />
    </svg>
  );
}

/** The logo dots and the site name. Not the municipality emblem, which needs approval. */
function Brand() {
  return (
    <Link to="/catalog" className="shell-brand">
      <span className="shell-dots" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span>
        מאגרי ספקים
        <small>עיריית ירושלים</small>
      </span>
    </Link>
  );
}

/**
 * Top bar with the brand, the three section tabs and the account link, then the logo color
 * stripe. Below 48rem the tabs move to a bar fixed at the bottom of the screen (shell.css).
 */
export function SiteHeader() {
  const current = sectionOf(useLocation().pathname);
  return (
    <header className="shell-header">
      <div className="shell-header-inner">
        <Brand />
        <nav aria-label="ניווט ראשי" className="shell-nav">
          {SECTIONS.map((section) => (
            <Link
              key={section.key}
              to={section.to}
              aria-current={section.key === current ? 'page' : undefined}
            >
              <Icon path={ICONS[section.key]} />
              {section.label}
            </Link>
          ))}
        </nav>
        <Link to="/auth" className="shell-account" aria-label="כניסה והרשאות" title="כניסה והרשאות">
          <Icon path={USER_ICON} />
        </Link>
      </div>
      <div className="shell-stripe" aria-hidden="true" />
    </header>
  );
}
