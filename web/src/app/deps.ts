import type * as Site from '../data/site.ts';
import type * as CatalogView from '../catalog-view.ts';
import type { Session } from './session.ts';
import { EventBatcher } from './tracker.ts';

type SiteKey =
  | 'BASE'
  | 'openCatalog'
  | 'catalogStore'
  | 'clearCatalog'
  | 'catalog'
  | 'canAddSupplier'
  | 'eventRequest';
export type SiteApi = Pick<typeof Site, SiteKey | 'exchangeCode' | 'sendLink'>;
export type ViewApi = Pick<
  typeof CatalogView,
  'setSuppliers' | 'options' | 'render' | 'setOpenHandler'
>;
export interface DetailsApi {
  open(id: string, token: string): Promise<void>;
}
export interface WriteApi {
  bind(refresh: () => Promise<void>): void;
  open(token: string): Promise<void>;
}

/** Everything the page needs. Tests pass fakes; main.ts passes the real modules. */
export interface AppDeps {
  win: Window;
  site: SiteApi;
  view: ViewApi;
  details: DetailsApi;
  write: WriteApi;
}

export interface AppState {
  session: Session | null;
  userId: string | null;
}

export class Page {
  readonly deps: AppDeps;
  readonly state: AppState = { session: null, userId: null };
  private events: EventBatcher | null = null;

  constructor(deps: AppDeps) {
    this.deps = deps;
  }

  get doc(): Document {
    return this.deps.win.document;
  }

  el(selector: string): HTMLElement {
    const node = this.doc.querySelector<HTMLElement>(selector);
    if (!node) throw new Error(`Missing element ${selector}`);
    return node;
  }

  context() {
    const { location, history, sessionStorage } = this.deps.win;
    return { location, history, storage: sessionStorage };
  }

  /** Queues a usage event for the next batch; failures never interrupt the user. */
  track(eventType: string, details: Record<string, string> = {}): void {
    const { session, userId } = this.state;
    if (!session || !userId) return;
    this.events ??= new EventBatcher(this.deps.win, (events) =>
      this.deps.site.eventRequest(session.token, events),
    );
    this.events.add({ actor_id: userId, event_type: eventType, details });
  }
}
