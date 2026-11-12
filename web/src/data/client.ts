import type { PublicSchema } from '../database.types.ts';

type Resource = keyof PublicSchema;
type Row<T extends Resource> = PublicSchema[T]['Row'];
type WritableResource = {
  [T in Resource]: PublicSchema[T] extends { Insert: unknown; Update: unknown } ? T : never;
}[Resource];
type Insert<T extends WritableResource> = PublicSchema[T] extends { Insert: infer I } ? I : never;
type Update<T extends WritableResource> = PublicSchema[T] extends { Update: infer U } ? U : never;

export class DataError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(
      status === 401
        ? 'פג תוקף ההתחברות. יש להתחבר מחדש.'
        : status === 403
          ? 'אין לך הרשאה לבצע פעולה זו.'
          : status === 409
            ? 'הרשומה כבר קיימת. בדקו את פרטי הספק לפני ניסיון נוסף.'
            : 'לא ניתן להשלים את הפעולה. יש לנסות שוב.',
    );
    this.status = status;
  }
}

class UnconfirmedChange extends Error {
  constructor() {
    super('לא ניתן לאמת אם השינוי נשמר. יש לרענן ולבדוק לפני ניסיון נוסף.');
  }
}

export interface ClientOptions {
  baseUrl: string;
  publicKey: string;
  token: string;
  fetcher?: typeof fetch;
}

export class DataClient {
  private readonly fetcher: typeof fetch;
  private readonly root: string;
  private readonly headers: Record<string, string>;

  constructor(options: ClientOptions) {
    this.root = `${options.baseUrl.replace(/\/$/, '')}/rest/v1`;
    this.fetcher = options.fetcher ?? fetch;
    this.headers = {
      apikey: options.publicKey,
      Authorization: `Bearer ${options.token}`,
      'Content-Type': 'application/json',
    };
  }

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    let response: Response;
    const headers = new Headers(this.headers);
    new Headers(init.headers).forEach((value, key) => {
      headers.set(key, value);
    });
    try {
      const fetcher = this.fetcher;
      response = await fetcher(`${this.root}/${path}`, {
        ...init,
        headers,
      });
    } catch {
      throw new DataError(0);
    }
    if (!response.ok) throw new DataError(response.status);
    if (response.status === 204 || headers.get('Prefer') === 'return=minimal') return null;
    try {
      return (await response.json()) as unknown;
    } catch {
      throw new DataError(0);
    }
  }

  async rpc(name: 'my_access'): Promise<unknown> {
    return this.request(`rpc/${name}`, { method: 'POST', body: '{}' });
  }

  async supplierWrite(
    name: 'save_supplier_membership' | 'rename_supplier' | 'replace_supplier_contact',
    payload: Record<string, string>,
  ): Promise<string> {
    const result = await this.request(`rpc/${name}`, {
      method: 'POST',
      body: JSON.stringify({ payload }),
    });
    if (typeof result !== 'string') throw new DataError(0);
    return result;
  }

  async list<T extends Resource>(
    table: T,
    filters: Record<string, string> = {},
  ): Promise<Row<T>[]> {
    const result: Row<T>[] = [];
    const pageSize = 500;
    for (;;) {
      const query = new URLSearchParams({
        order: table === 'profiles' ? 'user_id.asc' : 'id.asc',
        ...filters,
        select: '*',
        limit: String(pageSize),
        offset: String(result.length),
      });
      const page = await this.request(`${table}?${query.toString()}`);
      if (!Array.isArray(page)) throw new DataError(0);
      result.push(...(page as Row<T>[]));
      if (page.length < pageSize) return result;
    }
  }

  async insert<T extends WritableResource>(table: T, row: Insert<T>): Promise<void> {
    await this.request(table, {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(row),
    });
  }

  async update<T extends WritableResource>(
    table: T,
    filters: Record<string, string>,
    row: Update<T>,
  ): Promise<void> {
    if (Object.keys(filters).length === 0) throw new Error('Update requires a filter');
    const result = await this.request(`${table}?${new URLSearchParams(filters).toString()}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(row),
    });
    if (!Array.isArray(result) || result.length === 0) throw new UnconfirmedChange();
  }

  async remove(table: WritableResource, filters: Record<string, string>): Promise<void> {
    if (Object.keys(filters).length === 0) throw new Error('Delete requires a filter');
    const result = await this.request(`${table}?${new URLSearchParams(filters).toString()}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=representation' },
    });
    if (!Array.isArray(result) || result.length === 0) throw new UnconfirmedChange();
  }
}
