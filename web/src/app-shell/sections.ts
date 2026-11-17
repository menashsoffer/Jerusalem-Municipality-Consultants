// The three top-level sections of the site (DESIGN.md section 6.1). Every route belongs to one,
// so the matching tab stays selected on the screens inside it.

export interface Section {
  key: 'catalog' | 'requests' | 'admin';
  label: string;
  to: string;
}

export const SECTIONS: readonly Section[] = [
  { key: 'catalog', label: 'איתור ספקים', to: '/catalog' },
  { key: 'requests', label: 'בקשות התקשרות', to: '/engagement' },
  { key: 'admin', label: 'ניהול', to: '/admin' },
];

const CATALOG_PATHS = ['/catalog', '/supplier'];
const REQUEST_PATHS = ['/engagement', '/route-check'];

function startsWithAny(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** The section a path belongs to, or null for screens outside the three (sign-in, not found). */
export function sectionOf(pathname: string): Section['key'] | null {
  if (startsWithAny(pathname, CATALOG_PATHS)) return 'catalog';
  if (startsWithAny(pathname, REQUEST_PATHS)) return 'requests';
  const adminPaths = ['/admin', '/categories', '/identifiers', '/users', '/thresholds'];
  if (startsWithAny(pathname, [...adminPaths, '/load-control'])) return 'admin';
  return null;
}
