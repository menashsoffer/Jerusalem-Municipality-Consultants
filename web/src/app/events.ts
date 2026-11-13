/* Event wiring for filters, sign-in controls and usage tracking. */
import type { Page } from './deps.ts';
import { googleAuthorizeUrl, SESSION_KEY } from './session.ts';

/** Opening a dialog reports its own errors; nothing more to do here. */
function ignore(): void {
  return undefined;
}

const SEARCH_TRACK_DELAY_MS = 900;
const MAX_TRACKED_TERM = 200;
/** Filter element id, the event key it is tracked under, and whether it narrows other lists. */
const FILTERS: [string, string, boolean][] = [
  ['#registry', 'registry', true],
  ['#field-filter', 'field', false],
  ['#category-filter', 'category', true],
  ['#subcategory-filter', 'subcategory', false],
  ['#unit-filter', 'unit', false],
  ['#validity-filter', 'validity', false],
];

function bindSearch(page: Page): void {
  const search = page.el('#query') as HTMLInputElement;
  let timer: ReturnType<typeof setTimeout> | undefined;
  search.addEventListener('input', () => {
    page.deps.view.render();
    clearTimeout(timer);
    timer = setTimeout(() => {
      const term = search.value.trim().slice(0, MAX_TRACKED_TERM);
      if (term) page.track('search', { term });
    }, SEARCH_TRACK_DELAY_MS);
  });
}

function bindFilters(page: Page): void {
  const { view } = page.deps;
  for (const [selector, key, narrows] of FILTERS) {
    const input = page.el(selector) as HTMLSelectElement;
    input.addEventListener('change', () => {
      if (narrows) view.options();
      view.render();
      page.track('filter', { [key]: input.value });
    });
  }
  page.el('#reset').addEventListener('click', () => {
    (page.el('#query') as HTMLInputElement).value = '';
    for (const [selector] of FILTERS) (page.el(selector) as HTMLSelectElement).value = '';
    view.options();
    view.render();
  });
}

export function bindCatalog(page: Page): void {
  const { view, details, write } = page.deps;
  bindSearch(page);
  bindFilters(page);
  view.setOpenHandler((id) => {
    const { session } = page.state;
    if (session) details.open(id, session.token).catch(ignore);
  });
  page.el('#supplier-close').addEventListener('click', () => {
    details.close();
  });
  page.el('#add-open').addEventListener('click', () => {
    const { session } = page.state;
    if (session) write.open(session.token).catch(ignore);
  });
}

function signOut(page: Page): void {
  page.deps.win.sessionStorage.removeItem(SESSION_KEY);
  page.deps.win.location.reload();
}

async function sendLink(page: Page, form: HTMLFormElement): Promise<void> {
  const message = page.el('#login-message');
  message.textContent = 'שולח קישור...';
  const value = new FormData(form).get('email');
  const email = typeof value === 'string' ? value.trim() : '';
  const { location } = page.deps.win;
  try {
    const response = await page.deps.site.sendLink(email, location.origin + location.pathname);
    if (!response.ok) throw new Error('auth');
    message.textContent = 'אם החשבון מורשה, קישור כניסה נשלח לדוא״ל.';
  } catch {
    message.textContent = 'לא ניתן לשלוח קישור כעת. בדקו את פרטי החשבון ונסו שוב.';
  }
}

async function googleSignIn(page: Page): Promise<void> {
  const { location } = page.deps.win;
  const redirect = location.origin + location.pathname;
  location.assign(await googleAuthorizeUrl(page.context(), page.deps.site.BASE, redirect));
}

export function bindAuth(page: Page): void {
  const dialog = page.el('#login-dialog') as HTMLDialogElement;
  page.el('#login-open').addEventListener('click', () => {
    dialog.showModal();
  });
  page.el('#login-close').addEventListener('click', () => {
    dialog.close();
  });
  page.el('#logout').addEventListener('click', () => {
    signOut(page);
  });
  page.el('#access-logout').addEventListener('click', () => {
    signOut(page);
  });
  (page.el('#login-form') as HTMLFormElement).addEventListener('submit', (event) => {
    event.preventDefault();
    void sendLink(page, event.currentTarget as HTMLFormElement);
  });
  page.doc.querySelector('#google-login')?.addEventListener('click', () => {
    googleSignIn(page).catch(() => {
      page.el('#login-message').textContent = 'לא ניתן להתחבר באמצעות Google כעת.';
    });
  });
}

function actionName(target: Element): string {
  if (target.id) return target.id;
  if (target.classList.contains('supplier-detail-open')) return 'open_supplier';
  return target.closest('.card') ? 'open_source' : '';
}

/** Records which button or link was used. Only ids and fixed names, never typed content. */
export function bindTracking(page: Page): void {
  page.doc.addEventListener('click', (event) => {
    const origin = event.target as Element | null;
    const target = origin?.closest('button, a');
    if (!target || !page.state.session) return;
    const action = actionName(target);
    if (action) page.track('action', { action });
  });
}
