// Runs the Supabase migrations in an isolated PostgreSQL (PGlite). The auth schema
// below emulates only the parts of Supabase Auth that the migrations use.
import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const MIGRATIONS_DIR = resolve(root, 'supabase', 'migrations');

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

export async function migrationFiles() {
  const names = (await readdir(MIGRATIONS_DIR)).filter((n) => n.endsWith('.sql'));
  return names.sort();
}

export async function migratedDatabase({ until } = {}) {
  const db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(SUPABASE_STUB);
  for (const name of await migrationFiles()) {
    if (until && name > until) break;
    try {
      await db.exec(await readFile(resolve(MIGRATIONS_DIR, name), 'utf8'));
    } catch (error) {
      await db.close();
      throw new Error(`${name}: ${error.message}`, { cause: error });
    }
  }
  return db;
}

export function claimsFor(user, email = `${user}@example.test`) {
  return JSON.stringify({ sub: user, role: 'authenticated', is_anonymous: false, email });
}

// Runs `action` as an authenticated user, or as anon when user is null.
export async function as(db, user, action) {
  const claims = user ? claimsFor(user) : '{"role":"anon"}';
  await db.query("select set_config('request.jwt.claims', $1, false)", [claims]);
  await db.exec(user ? 'set role authenticated' : 'set role anon');
  try {
    return await action();
  } finally {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claims', '', false)");
  }
}
