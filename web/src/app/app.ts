/* Page startup: sign-in, access check, then the catalog from the normalized supplier model. */
import { DataError } from '../data/client.ts';
import type { Access } from '../data/access.ts';
import { Page, type AppDeps } from './deps.ts';
import { installDialogFallbacks } from './dialogs.ts';
import { bindAuth, bindCatalog, bindTracking } from './events.ts';
import { exchangeGoogleCode, SESSION_KEY, takeAuthError, takeSession } from './session.ts';

const ACCESS_MESSAGES: Record<Access['state'], [string, string]> = {
  pending: ['הבקשה ממתינה לאישור', 'אפשר לחזור לכאן לאחר אישור מנהל המערכת.'],
  rejected: ['בקשת הגישה נדחתה', 'יש לפנות למנהל המערכת לבירור.'],
  blocked: ['הגישה חסומה', 'יש לפנות למנהל המערכת לבירור.'],
  unregistered: ['נדרשת בקשת גישה', 'יש לפנות למנהל המערכת לצורך רישום.'],
  active: ['אין הרשאה פעילה', 'יש לפנות למנהל המערכת לבירור.'],
};
const CATALOG_UNAVAILABLE: [string, string] = [
  'הקטלוג עדיין אינו זמין',
  'לא ניתן לטעון את הקטלוג. בדקו את החיבור או פנו למנהל המערכת.',
];
const VERIFY_FAILED = 'לא ניתן לאמת הרשאה. יש להתחבר מחדש או לפנות למנהל המערכת.';
const LOGIN_FAILED = 'ההתחברות לא הושלמה. יש לנסות שוב.';

function showSignedIn(page: Page): void {
  page.el('#login-open').hidden = true;
  page.el('#logout').hidden = false;
}

function showAccess(page: Page, [title, message]: [string, string]): void {
  page.el('#access-title').textContent = title;
  page.el('#access-message').textContent = message;
  page.el('#access-status').hidden = false;
  showSignedIn(page);
}

export async function loadData(page: Page): Promise<void> {
  const { session } = page.state;
  if (!session) throw new Error('auth');
  page.deps.view.setSuppliers(await page.deps.site.catalog(session.token));
}

function updateCatalog(page: Page): void {
  const state = page.deps.site.catalogStore.getSnapshot();
  const visible = !!state.catalog;
  page.el('#private-content').hidden = !visible;
  page.el('#add-open').hidden = state.refreshing || !page.deps.site.canAddSupplier();
  if (visible) {
    showSignedIn(page);
    page.deps.view.setSuppliers(state.suppliers);
  }
  let status = page.doc.querySelector('#catalog-refresh');
  if (!status) {
    status = page.doc.createElement('p');
    status.id = 'catalog-refresh';
    status.setAttribute('role', 'status');
    page.el('#private-content').prepend(status);
  }
  status.textContent = state.refreshing
    ? 'מתעדכן…'
    : state.error
      ? 'לא ניתן לעדכן כעת. מוצג העותק שנשמר במכשיר.'
      : '';
}

/** Shows a same-user cache while one request validates both access and catalog freshness. */
async function enter(page: Page, token: string): Promise<void> {
  const unsubscribe = page.deps.site.catalogStore.subscribe(() => {
    updateCatalog(page);
  });
  page.deps.win.addEventListener('pagehide', unsubscribe, { once: true });
  const state = await page.deps.site.openCatalog(token);
  page.state.userId = state.userId;
  const access = state.access;
  if (!access) throw new Error('auth');
  if (access.state !== 'active' || !access.member) {
    showAccess(page, ACCESS_MESSAGES[access.state]);
    return;
  }
  showSignedIn(page);
  updateCatalog(page);
  page.track('page_view', { page: page.deps.win.location.pathname });
  for (const name of ['catalog-request', 'catalog-build', 'catalog-render']) {
    const measure = performance.getEntriesByName(name).at(-1);
    if (measure) page.track('performance', { metric: name, duration_ms: String(measure.duration) });
  }
}

async function init(page: Page): Promise<void> {
  const ctx = page.context();
  const message = page.el('#login-message');
  const authError = takeAuthError(ctx);
  if (authError) message.textContent = authError;
  try {
    await exchangeGoogleCode(ctx, page.deps.site.exchangeCode);
  } catch {
    message.textContent = LOGIN_FAILED;
  }
  page.state.session = takeSession(ctx);
  if (page.state.session) {
    try {
      await enter(page, page.state.session.token);
      return;
    } catch (error) {
      if (!(error instanceof DataError) || ![401, 403].includes(error.status)) {
        showAccess(page, CATALOG_UNAVAILABLE);
        return;
      }
      await page.deps.site.clearCatalog();
      page.state.session = null;
      page.state.userId = null;
      ctx.storage.removeItem(SESSION_KEY);
      message.textContent = error.status === 403 ? error.message : VERIFY_FAILED;
    }
  }
  (page.el('#login-dialog') as HTMLDialogElement).showModal();
}

/** Wires the page and starts sign-in. Resolves once the first screen is shown. */
export async function start(deps: AppDeps): Promise<void> {
  const page = new Page(deps);
  installDialogFallbacks(deps.win);
  let requestStarted: (() => void) | undefined;
  const requesting = new Promise<void>((resolve) => {
    requestStarted = resolve;
  });
  const unsubscribe = deps.site.catalogStore.subscribe(() => {
    if (deps.site.catalogStore.getSnapshot().refreshing) requestStarted?.();
  });
  const initialized = init(page);
  await Promise.race([requesting, initialized]);
  unsubscribe();
  bindCatalog(page);
  bindAuth(page);
  bindTracking(page);
  deps.write.bind(() => loadData(page));
  return initialized;
}
