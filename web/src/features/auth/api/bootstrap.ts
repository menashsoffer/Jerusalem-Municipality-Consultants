import {
  SESSION_KEY,
  exchangeGoogleCode,
  takeAuthError,
  takeSession,
  FAILED_MESSAGE,
  type BrowserContext,
} from '../../../data/session.ts';
import { exchangeCode } from '../../../data/site.ts';
export async function prepareAdmin(ctx: BrowserContext, exchange = exchangeCode) {
  let message = takeAuthError(ctx);
  try {
    await exchangeGoogleCode(ctx, exchange);
  } catch {
    message = FAILED_MESSAGE;
  }
  const session = takeSession(ctx);
  if (message) ctx.storage.removeItem(SESSION_KEY);
  return { session: message ? null : session, message };
}
