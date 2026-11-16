import type { Access } from './access.ts';
import type { CatalogData } from './catalog.ts';
import { buildCatalog, type Supplier } from '../catalog-model.ts';
import { cacheSchema, type CatalogCache, type CacheEntry } from './catalog-cache.ts';
import { DataError } from './client.ts';
import { expandCatalog, snapshotSchema, type Snapshot } from './snapshot-schema.ts';

export interface CatalogState {
  userId: string | null;
  access: Access | null;
  catalog: CatalogData | null;
  suppliers: Supplier[];
  refreshing: boolean;
  error: Error | null;
}
const empty = (): CatalogState => ({
  userId: null,
  access: null,
  catalog: null,
  suppliers: [],
  refreshing: false,
  error: null,
});
type Request = (version: string | null) => Promise<unknown>;

/** The JWT subject chooses a cache bucket only. Server authorization always comes from the RPC. */
export function cacheUserId(token: string): string | null {
  try {
    const payload = token.split('.')[1] ?? '';
    const value: unknown = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    const subject = (value as Record<string, unknown> | null)?.sub;
    return typeof subject === 'string' ? subject : null;
  } catch {
    return null;
  }
}

/** Generation checks discard requests superseded by logout or a user switch. */
export class CatalogStore {
  private state = empty();
  private generation = 0;
  private cached: CacheEntry | null = null;
  private listeners = new Set<() => void>();
  readonly cache: CatalogCache;

  constructor(cache: CatalogCache) {
    this.cache = cache;
  }
  getSnapshot = (): CatalogState => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(state: CatalogState): void {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
  async clear(): Promise<void> {
    this.generation++;
    this.cached = null;
    this.publish(empty());
    await this.cache.clear();
  }
  private show(entry: CacheEntry, access: Access | null, refreshing: boolean): void {
    performance.mark('catalog-build-start');
    const catalog = expandCatalog(entry.catalog);
    const suppliers = buildCatalog(catalog);
    performance.measure('catalog-build', 'catalog-build-start');
    this.publish({ userId: entry.userId, access, catalog, suppliers, refreshing, error: null });
  }
  private async readCache(userId: string | null): Promise<CacheEntry | null> {
    if (!userId) return null;
    try {
      const parsed = cacheSchema.safeParse(await this.cache.read(userId));
      return parsed.success && parsed.data.userId === userId ? parsed.data : null;
    } catch {
      return null;
    }
  }
  private async accept(response: Snapshot): Promise<void> {
    if (response.access.state !== 'active' || !response.access.member) {
      this.cached = null;
      this.publish({ ...empty(), userId: response.user_id, access: response.access });
      await this.cache.clear();
      return;
    }
    const entry = response.unchanged
      ? this.cached
      : response.catalog
        ? {
            userId: response.user_id,
            version: response.version,
            catalog: response.catalog,
          }
        : null;
    if (entry?.userId !== response.user_id || entry.version !== response.version)
      throw new DataError(0);
    this.cached = entry;
    this.show(entry, response.access, false);
    try {
      await this.cache.write(entry);
    } catch {
      /* Persistence is optional. */
    }
  }
  private async prepare(userId: string | null): Promise<CacheEntry | null> {
    if (this.state.userId !== userId) {
      this.cached = null;
      this.publish(empty());
    }
    return this.cached ?? (await this.readCache(userId));
  }
  private parse(raw: unknown, userId: string | null): Snapshot {
    const parsed = snapshotSchema.safeParse(raw);
    if (!parsed.success) throw new DataError(0);
    if (userId && parsed.data.user_id !== userId) throw new DataError(401);
    return parsed.data;
  }
  private async fail(error: unknown): Promise<void> {
    if (error instanceof DataError && [401, 403].includes(error.status)) await this.clear();
    this.publish({
      ...this.state,
      refreshing: false,
      error: error instanceof Error ? error : new DataError(0),
    });
  }
  async load(request: Request, userId: string | null): Promise<CatalogState> {
    const generation = ++this.generation;
    const cached = await this.prepare(userId);
    if (generation !== this.generation) throw new DataError(0);
    this.cached = cached;
    if (cached) this.show(cached, this.state.access, true);
    else this.publish({ ...this.state, refreshing: true, error: null });
    try {
      performance.mark('catalog-request-start');
      const raw = await request(cached?.version ?? null);
      performance.measure('catalog-request', 'catalog-request-start');
      if (generation !== this.generation) throw new DataError(0);
      await this.accept(this.parse(raw, userId));
      return this.state;
    } catch (error) {
      if (generation === this.generation) await this.fail(error);
      throw error;
    }
  }
}
