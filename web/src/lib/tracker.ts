/* Usage events are queued and sent together. Where the browser has fetchLater(), it holds the
   batch and sends it after BATCH_WINDOW_MS or when the page goes away, whichever comes first.
   Elsewhere a timer sends the batch, and leaving the page sends what is left with keepalive.
   Either way, an event recorded just before sign-out or closing the tab still arrives. */
import type { PublicSchema } from '../database.types.ts';

export type TrackedEvent = PublicSchema['activity_events']['Insert'];
export interface EventRequest {
  url: string;
  init: RequestInit;
}
export type BuildRequest = (events: TrackedEvent[]) => EventRequest;

interface LaterResult {
  readonly activated: boolean;
}
type FetchLater = (url: string, init: RequestInit & { activateAfter: number }) => LaterResult;

export const BATCH_WINDOW_MS = 10_000;
/** Well under the 64 KB that fetchLater and keepalive allow per page. */
export const MAX_BATCH = 50;

export class EventBatcher {
  private readonly win: Window;
  private readonly build: BuildRequest;
  private queue: TrackedEvent[] = [];
  private later: LaterResult | null = null;
  private controller: AbortController | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(win: Window, build: BuildRequest) {
    this.win = win;
    this.build = build;
    win.addEventListener('pagehide', () => {
      // A pending fetchLater() is sent by the browser itself when the page goes away.
      if (!this.later || this.later.activated) this.sendNow();
    });
  }

  add(event: TrackedEvent): void {
    if (this.later?.activated) this.reset();
    this.queue.push(event);
    if (this.queue.length >= MAX_BATCH) this.sendNow();
    else if (!this.scheduleLater())
      this.timer ??= setTimeout(() => {
        this.sendNow();
      }, BATCH_WINDOW_MS);
  }

  /** Replaces the held batch with one that includes the new event. False if unavailable. */
  private scheduleLater(): boolean {
    const fetchLater = (this.win as Window & { fetchLater?: FetchLater }).fetchLater;
    if (typeof fetchLater !== 'function') return false;
    this.controller?.abort();
    const controller = new AbortController();
    const { url, init } = this.build([...this.queue]);
    try {
      this.later = fetchLater.call(this.win, url, {
        ...init,
        signal: controller.signal,
        activateAfter: BATCH_WINDOW_MS,
      });
      this.controller = controller;
      return true;
    } catch {
      // Over quota or refused: the timer path below sends the whole queue instead.
      this.later = null;
      this.controller = null;
      return false;
    }
  }

  private sendNow(): void {
    if (this.later?.activated) this.reset();
    this.controller?.abort();
    const events = this.queue;
    this.reset();
    if (!events.length) return;
    const { url, init } = this.build(events);
    try {
      this.win.fetch(url, { ...init, keepalive: true }).catch(() => undefined);
    } catch {
      // Usage tracking never interrupts the user.
    }
  }

  private reset(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.queue = [];
    this.later = null;
    this.controller = null;
  }
}
