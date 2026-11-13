/* Page startup: sign-in, access check, then the catalog from the normalized supplier model. */
import type { Access } from '../data/access.ts';
import { Page, type AppDeps } from './deps.ts';
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

async function currentUserId(page: Page, token: string): Promise<string> {
  const response = await page.deps.site.currentUser(token);
  if (!response.ok) throw new Error('auth');
  const user: unknown = await response.json();
  const id = (user as Record<string, unknown> | null)?.id;
  if (typeof id !== 'string') throw new Error('auth');
  return id;
}

/** Shows the catalog to an active member, or the reason they cannot see it. */
async function enter(page: Page, token: string): Promise<void> {
  const userId = await currentUserId(page, token);
  page.state.userId = userId;
  const access = await page.deps.site.access(token, userId);
  if (access.state !== 'active' || !access.member) {
    showAccess(page, ACCESS_MESSAGES[access.state]);
    return;
  }
  try {
    await loadData(page);
  } catch {
    showAccess(page, CATALOG_UNAVAILABLE);
    return;
  }
  showSignedIn(page);
  page.el('#private-content').hidden = false;
  page.el('#add-open').hidden = !page.deps.site.canAddSupplier();
  page.track('page_view', { page: page.deps.win.location.pathname });
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
    } catch {
      page.state.session = null;
      page.state.userId = null;
      ctx.storage.removeItem(SESSION_KEY);
      message.textContent = VERIFY_FAILED;
    }
  }
  (page.el('#login-dialog') as HTMLDialogElement).showModal();
}

/** Wires the page and starts sign-in. Resolves once the first screen is shown. */
export function start(deps: AppDeps): Promise<void> {
  const page = new Page(deps);
  bindCatalog(page);
  bindAuth(page);
  bindTracking(page);
  deps.write.bind(() => loadData(page));
  return init(page);
}
