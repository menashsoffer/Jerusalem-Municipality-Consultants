import type * as Site from '../data/site.ts';
import type * as CatalogView from '../catalog-view.ts';
import type { Session } from './session.ts';

type SiteKey = 'BASE' | 'currentUser' | 'access' | 'catalog' | 'canAddSupplier' | 'track';
export type SiteApi = Pick<typeof Site, SiteKey | 'exchangeCode' | 'sendLink'>;
export type ViewApi = Pick<
  typeof CatalogView,
  'setSuppliers' | 'options' | 'render' | 'setOpenHandler'
>;
export interface DetailsApi {
  open(id: string, token: string): Promise<void>;
  close(): void;
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

  /** Records a usage event; failures never interrupt the user. */
  track(eventType: string, details: Record<string, string> = {}): void {
    const { session, userId } = this.state;
    if (!session || !userId) return;
    this.deps.site
      .track(session.token, { actor_id: userId, event_type: eventType, details })
      .catch(() => undefined);
  }
}
