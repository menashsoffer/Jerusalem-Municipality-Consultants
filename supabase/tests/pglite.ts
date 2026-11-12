// Runs the Supabase migrations in an isolated PostgreSQL (PGlite). The stub below
// emulates only the parts of Supabase Auth that the migrations use.
import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';

const MIGRATIONS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema extensions;
  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_app_meta_data jsonb not null default '{}',
    raw_user_meta_data jsonb not null default '{}',
    created_at timestamptz not null default now()
  );
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(auth.jwt() ->> 'sub', '')::uuid
  $$;
  grant usage on schema auth, extensions to anon, authenticated, service_role;
  grant execute on function auth.jwt(), auth.uid() to anon, authenticated, service_role;
`;

export interface MigrationRange {
  after?: string;
  until?: string;
}

export async function migrationNames(): Promise<string[]> {
  const names = await readdir(MIGRATIONS_DIR);
  return names.filter((n) => n.endsWith('.sql')).sort();
}

export async function applyMigrations(db: PGlite, range: MigrationRange = {}): Promise<void> {
  for (const name of await migrationNames()) {
    if (range.after !== undefined && name <= range.after) continue;
    if (range.until !== undefined && name > range.until) break;
    const sql = await readFile(resolve(MIGRATIONS_DIR, name), 'utf8');
    try {
      await db.exec(sql);
    } catch (error) {
      throw new Error(`${name}: ${String(error)}`, { cause: error });
    }
  }
}

export async function emptyDatabase(): Promise<PGlite> {
  const db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(SUPABASE_STUB);
  return db;
}

export async function migratedDatabase(range: MigrationRange = {}): Promise<PGlite> {
  const db = await emptyDatabase();
  await applyMigrations(db, range);
  return db;
}

// Runs `action` as a signed-in user, or as anon when user is null.
export async function as<T>(db: PGlite, user: string | null, action: () => Promise<T>) {
  const claims = user
    ? JSON.stringify({ sub: user, role: 'authenticated', email: `${user}@example.test` })
    : '{"role":"anon"}';
  await db.query("select set_config('request.jwt.claims', $1, false)", [claims]);
  await db.exec(user ? 'set role authenticated' : 'set role anon');
  try {
    return await action();
  } finally {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claims', '', false)");
  }
}

export async function count(db: PGlite, sql: string): Promise<number> {
  const result = await db.query<{ n: number }>(`select count(*)::int as n from (${sql}) q`);
  return result.rows[0]?.n ?? Number.NaN;
}
