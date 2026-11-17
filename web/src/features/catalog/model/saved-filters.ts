import type { Filters } from '../../../catalog-filter.ts';

/**
 * The catalog's search and filters, kept per history entry, so "back" from a supplier returns
 * to the same results (supplier page spec, section 3). Session storage can be missing or
 * blocked; then the catalog simply starts empty.
 */
const PREFIX = 'catalog-filters:';

function storage(): Storage | null {
  try {
    return globalThis.sessionStorage;
  } catch {
    return null;
  }
}

export function saveFilters(entry: string, filters: Filters): void {
  try {
    storage()?.setItem(PREFIX + entry, JSON.stringify(filters));
  } catch {
    // Quota or privacy mode: losing the saved search is acceptable.
  }
}

/** Saved values count only when every field has the same type as in a fresh filter set. */
export function restoreFilters(entry: string, fresh: Filters): Filters | null {
  try {
    const raw: unknown = JSON.parse(storage()?.getItem(PREFIX + entry) ?? 'null');
    if (typeof raw !== 'object' || raw === null) return null;
    const saved = raw as Record<string, unknown>;
    const sameShape = Object.entries(fresh).every(
      ([name, value]) => typeof saved[name] === typeof value,
    );
    return sameShape ? { ...fresh, ...saved, today: fresh.today } : null;
  } catch {
    return null;
  }
}
