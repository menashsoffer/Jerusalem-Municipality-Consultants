/* Page startup: sign-in, access check, then the catalog from the normalized supplier model. */
import type { Access } from '../data/access.ts';
import type { CatalogState } from '../data/snapshot.ts';
import { DataError } from '../data/client.ts';
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
  await page.deps.site.loadSnapshot(session.token);
}

function clearPage(page: Page): void {
  page.state.session = null;
  page.state.userId = null;
  page.context().storage.removeItem(SESSION_KEY);
  page.el('#private-content').hidden = true;
  page.el('#add-open').hidden = true;
  clearPrivateViews(page);
  page.el('#login-message').textContent = VERIFY_FAILED;
  (page.el('#login-dialog') as HTMLDialogElement).showModal();
}

function clearPrivateViews(page: Page): void {
  page.deps.view.setSuppliers([]);
  for (const selector of ['#supplier-dialog', '#add-dialog']) {
    const dialog = page.el(selector) as HTMLDialogElement;
    if (dialog.open) dialog.close();
  }
  page.el('#supplier-content').replaceChildren();
}

function showSnapshot(page: Page, state: CatalogState): void {
  page.state.userId = state.userId;
  const feedback = page.el('#catalog-feedback');
  feedback.hidden = !state.refreshing;
  feedback.textContent = state.refreshing ? 'מתעדכן' : '';
  if (state.access && (state.access.state !== 'active' || !state.access.member)) {
    page.el('#private-content').hidden = true;
    page.el('#add-open').hidden = true;
    clearPrivateViews(page);
    showAccess(page, ACCESS_MESSAGES[state.access.state]);
    return;
  }
  if (!state.catalog) return;
  page.deps.view.setSuppliers(state.suppliers);
  showSignedIn(page);
  page.el('#access-status').hidden = true;
  page.el('#private-content').hidden = false;
  page.el('#add-open').hidden = state.refreshing || !page.deps.site.canAddSupplier();
  if (!state.refreshing) {
    page.track('catalog_load', { ...state.timings, render_ms: page.deps.view.renderDuration() });
    if (!page.state.viewed) {
      page.state.viewed = true;
      page.track('page_view', { page: page.deps.win.location.pathname });
    }
  }
}

async function enter(page: Page, token: string, onRequest: () => void): Promise<void> {
  try {
    await page.deps.site.loadSnapshot(token, undefined, onRequest);
  } catch (error) {
    page.el('#private-content').hidden = true;
    page.el('#add-open').hidden = true;
    page.deps.view.setSuppliers([]);
    if (error instanceof DataError && error.status === 401) throw error;
    showAccess(page, CATALOG_UNAVAILABLE);
  }
}

async function init(page: Page, onRequest: () => void): Promise<void> {
  const ctx = page.context();
  const message = page.el('#login-message');
  const authError = takeAuthError(ctx);
  if (authError) message.textContent = authError;
  try {
    if (new URL(ctx.location.href).searchParams.has('code'))
      await exchangeGoogleCode(ctx, page.deps.site.exchangeCode);
  } catch {
    message.textContent = LOGIN_FAILED;
  }
  page.state.session = takeSession(ctx);
  if (page.state.session) {
    try {
      await enter(page, page.state.session.token, onRequest);
      return;
    } catch {
      page.state.session = null;
      page.state.userId = null;
      ctx.storage.removeItem(SESSION_KEY);
      message.textContent = VERIFY_FAILED;
    }
  }
  onRequest();
  await Promise.resolve();
  (page.el('#login-dialog') as HTMLDialogElement).showModal();
}

/** Wires the page and starts sign-in. Resolves once the first screen is shown. */
export async function start(deps: AppDeps): Promise<void> {
  const page = new Page(deps);
  deps.site.subscribe((state) => {
    if (state) showSnapshot(page, state);
    else clearPage(page);
  });
  let ready: () => void = () => undefined;
  const requestStarted = new Promise<void>((resolve) => {
    ready = resolve;
  });
  const loading = init(page, ready).finally(ready);
  await requestStarted;
  installDialogFallbacks(deps.win);
  bindCatalog(page);
  bindAuth(page);
  bindTracking(page);
  deps.write.bind(() => loadData(page));
  return loading;
}
