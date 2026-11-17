import { z } from '../../../data/rpc.ts';
import { sendLink, BASE, clearCatalog } from '../../../data/site.ts';
import { googleAuthorizeUrl, SESSION_KEY, type BrowserContext } from '../../../data/session.ts';
import { setAdminSession } from '../../../data/rpc.ts';
const emailSchema = z.email().max(320);
export interface LoginResult {
  message: string;
  error: string;
}
export async function requestLink(_previous: LoginResult, form: FormData): Promise<LoginResult> {
  const value = form.get('email');
  const parsed = emailSchema.safeParse(typeof value === 'string' ? value.trim() : value);
  if (!parsed.success) return { message: '', error: 'יש להזין כתובת דוא״ל תקינה.' };
  try {
    const redirect = window.location.origin + window.location.pathname;
    const response = await sendLink(parsed.data, redirect);
    if (!response.ok) throw new Error('request failed');
    return { message: 'אם החשבון מורשה, קישור כניסה נשלח לדוא״ל.', error: '' };
  } catch {
    return { message: '', error: 'לא ניתן לשלוח קישור כעת. יש לנסות שוב.' };
  }
}
export async function googleSignIn(ctx: BrowserContext): Promise<void> {
  const url = new URL(ctx.location.href);
  const target = await googleAuthorizeUrl(ctx, BASE, url.origin + url.pathname);
  window.location.assign(target);
}
export async function signOut(): Promise<void> {
  window.sessionStorage.removeItem(SESSION_KEY);
  setAdminSession(null);
  await clearCatalog();
  window.location.assign(window.location.pathname);
}
