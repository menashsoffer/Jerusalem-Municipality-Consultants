import { z } from './validation.ts';
import { catalogSchema } from './snapshot-schema.ts';

export const cacheSchema = z.object({
  userId: z.string().min(1),
  version: z.string().min(1),
  catalog: catalogSchema,
});
export type CacheEntry = z.infer<typeof cacheSchema>;
export interface CatalogCache {
  read(userId: string): Promise<unknown>;
  write(entry: CacheEntry): Promise<void>;
  clear(): Promise<void>;
}
const DATABASE = 'consultants-catalog-v1';
const STORE = 'catalog';
const CACHE_TIMEOUT_MS = 250;

function openDatabase(factory: IDBFactory | undefined): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    let finished = false;
    const finish = (db: IDBDatabase | null) => {
      if (finished) {
        db?.close();
        return;
      }
      finished = true;
      clearTimeout(timer);
      resolve(db);
    };
    const timer = setTimeout(() => {
      finish(null);
    }, CACHE_TIMEOUT_MS);
    try {
      if (!factory) {
        finish(null);
        return;
      }
      const request = factory.open(DATABASE, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE, { keyPath: 'userId' });
      };
      request.onerror = () => {
        finish(null);
      };
      request.onblocked = () => {
        finish(null);
      };
      request.onsuccess = () => {
        finish(request.result);
      };
    } catch {
      finish(null);
    }
  });
}
function transact<T>(db: IDBDatabase, operation: (store: IDBObjectStore) => IDBRequest<T>) {
  return new Promise<T | null>((resolve) => {
    let transaction: IDBTransaction | undefined;
    const finish = (value: T | null) => {
      clearTimeout(timer);
      db.close();
      resolve(value);
    };
    const timer = setTimeout(() => {
      transaction?.abort();
      finish(null);
    }, CACHE_TIMEOUT_MS);
    try {
      transaction = db.transaction(STORE, 'readwrite');
      const request = operation(transaction.objectStore(STORE));
      transaction.oncomplete = () => {
        finish(request.result);
      };
      transaction.onerror = () => {
        finish(null);
      };
      transaction.onabort = () => {
        finish(null);
      };
    } catch {
      finish(null);
    }
  });
}
/** Cache failures and blocked upgrades never block authentication or a network refresh. */
export function catalogCache(factory: IDBFactory | undefined): CatalogCache {
  let generation = 0;
  async function run<T>(operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
    const current = generation;
    const db = await openDatabase(factory);
    if (!db) return null;
    if (current !== generation) {
      db.close();
      return null;
    }
    return transact(db, operation);
  }
  return {
    read: (userId) => run<unknown>((store) => store.get(userId)),
    write: async (entry) => {
      await run((store) => store.put(entry));
    },
    clear: async () => {
      generation++;
      await run((store) => store.clear());
    },
  };
}
