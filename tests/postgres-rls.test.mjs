import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const packageUrl = process.env.CONSULTANTS_PGLITE_ENTRY
  ? pathToFileURL(process.env.CONSULTANTS_PGLITE_ENTRY).href
  : '@electric-sql/pglite';
const {PGlite} = await import(packageUrl);

// Emulate the small Supabase Auth interface used by our migration. This is a
// real isolated PostgreSQL engine, but it is not a substitute for Supabase E2E.
const setup = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, created_at timestamptz not null default now());
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(auth.jwt()->>'sub', '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.jwt(), auth.uid() to anon, authenticated;
  insert into auth.users (id) values ('10000000-0000-0000-0000-000000000003');
`;

const admin = '10000000-0000-0000-0000-000000000003';
const viewer = '20000000-0000-0000-0000-000000000003';
const pending = '30000000-0000-0000-0000-000000000003';
const claims = user => JSON.stringify({sub: user, role: 'authenticated', is_anonymous: false});

async function asAuthenticated(db, user, action) {
  await db.query("select set_config('request.jwt.claims', $1, false)", [claims(user)]);
  await db.exec('set role authenticated');
  try { return await action(); }
  finally { await db.exec('reset role'); }
}

async function bootstrappedDatabase() {
  const db = new PGlite();
  await db.exec(setup);
  await db.exec(await readFile(resolve(root, 'database/drafts/202611120001_directory_access.sql'), 'utf8'));
  await db.exec(`
    insert into auth.users(id) values ('${viewer}'), ('${pending}');
    insert into public.supplier_directory_units (id,name,kind,verified) values
      ('10000000-0000-0000-0000-000000000001','Administration','administration',true);
    insert into public.supplier_directory_units (id,name,kind,parent_id,verified) values
      ('10000000-0000-0000-0000-000000000002','Department','department','10000000-0000-0000-0000-000000000001',true);
    insert into public.supplier_directory_profiles(user_id,first_name,last_name,job_title,unit_id,purpose,status,reviewed_at,reviewed_by)
      values ('${admin}','Admin','One','Admin','10000000-0000-0000-0000-000000000002','Test access','active',now(),'${admin}'),
             ('${viewer}','Viewer','One','Employee','10000000-0000-0000-0000-000000000002','Test access','active',now(),'${admin}');
    insert into public.supplier_directory_roles (user_id,role,unit_id,granted_by) values
      ('${admin}','admin',null,'${admin}'),
      ('${viewer}','viewer','10000000-0000-0000-0000-000000000002','${admin}');
    insert into public.supplier_directory_categories(id,name,created_by) values
      ('40000000-0000-0000-0000-000000000001','Planning','${admin}');
  `);
  return db;
}

test('migration and rollback fixture execute in isolated PostgreSQL', async () => {
  const db = new PGlite();
  try {
    await db.exec(setup);
    const script = await readFile(resolve(root, 'database/tests/generated_access_rollback.sql'), 'utf8');
    await db.exec(script);
    const tables = await db.query("select to_regclass('public.supplier_directory_roles') as relation");
    assert.equal(tables.rows[0].relation, null, 'rollback must remove the test schema');
  } finally {
    await db.close();
  }
});

test('pending users can request access but cannot approve themselves or create roles', async () => {
  const db = await bootstrappedDatabase();
  try {
    await asAuthenticated(db, pending, async () => {
      await db.exec(`insert into public.supplier_directory_profiles(user_id,first_name,last_name,job_title,unit_id,purpose)
        values ('${pending}','Pending','User','Employee','10000000-0000-0000-0000-000000000002','Test access')`);
      const own = await db.query('select status from public.supplier_directory_profiles');
      assert.deepEqual(own.rows.map(row => row.status), ['pending']);
      const update = await db.exec(`update public.supplier_directory_profiles set status='active', reviewed_at=now(), reviewed_by='${pending}' where user_id='${pending}'`);
      assert.equal(update[0].affectedRows, 0);
      const categories = await db.query('select * from public.supplier_directory_categories');
      assert.equal(categories.rows.length, 0);
      await assert.rejects(db.exec(`insert into public.supplier_directory_roles(user_id,role,granted_by)
        values ('${pending}','admin','${pending}')`), {code: '42501'});
    });
    const actual = await db.query(`select status from public.supplier_directory_profiles where user_id='${pending}'`);
    assert.equal(actual.rows[0].status, 'pending');
  } finally { await db.close(); }
});

test('viewer may request a category but cannot approve or elevate privileges', async () => {
  const db = await bootstrappedDatabase();
  try {
    await asAuthenticated(db, viewer, async () => {
      assert.equal((await db.query('select * from public.supplier_directory_categories')).rows.length, 1);
      await db.exec(`insert into public.supplier_directory_category_requests(requested_by,proposed_name,description)
        values ('${viewer}','Surveying','Surveying services')`);
      assert.equal((await db.query('select * from public.supplier_directory_category_requests')).rows[0].status, 'pending');
      await assert.rejects(db.exec(`insert into public.supplier_directory_category_requests(requested_by,proposed_name,description,status)
        values ('${viewer}','Approved','Spoofed decision','approved')`), {code: '42501'});
      await assert.rejects(db.exec(`insert into public.supplier_directory_roles(user_id,role,granted_by)
        values ('${viewer}','admin','${viewer}')`), {code: '42501'});
      assert.equal((await db.query('select * from public.supplier_directory_audit')).rows.length, 0);
    });
    await asAuthenticated(db, admin, async () => {
      const request = (await db.query('select id from public.supplier_directory_category_requests')).rows[0].id;
      await db.query(`update public.supplier_directory_category_requests set status='linked', decided_by=$1,
        decided_at=now(), decision_note='Existing category', resolved_category_id='40000000-0000-0000-0000-000000000001' where id=$2`, [admin, request]);
      assert.ok((await db.query('select * from public.supplier_directory_audit')).rows.length > 0);
    });
    await asAuthenticated(db, viewer, async () => {
      assert.equal((await db.query('select status from public.supplier_directory_category_requests')).rows[0].status, 'linked');
    });
  } finally { await db.close(); }
});

test('blocked and revoked users immediately lose category access', async () => {
  const db = await bootstrappedDatabase();
  try {
    await asAuthenticated(db, admin, () => db.exec(`update public.supplier_directory_profiles
      set status='blocked', reviewed_at=now(), reviewed_by='${admin}', review_note='Test' where user_id='${viewer}'`));
    await asAuthenticated(db, viewer, async () => {
      assert.equal((await db.query('select * from public.supplier_directory_categories')).rows.length, 0);
      await assert.rejects(db.exec(`insert into public.supplier_directory_category_requests(requested_by,proposed_name,description)
        values ('${viewer}','New category','Denied for blocked user')`), {code: '42501'});
    });
    await asAuthenticated(db, admin, () => db.exec(`update public.supplier_directory_profiles
      set status='active', reviewed_at=now(), reviewed_by='${admin}' where user_id='${viewer}'`));
    await asAuthenticated(db, admin, () => db.exec(`update public.supplier_directory_roles
      set revoked_at=now() where user_id='${viewer}'`));
    await asAuthenticated(db, viewer, async () => assert.equal((await db.query('select * from public.supplier_directory_categories')).rows.length, 0));
  } finally { await db.close(); }
});

test('anonymous identities and users in a disabled administration cannot use categories', async () => {
  const db = await bootstrappedDatabase();
  try {
    await db.query("select set_config('request.jwt.claims', $1, false)",
      [JSON.stringify({sub: viewer, role: 'authenticated', is_anonymous: true})]);
    await db.exec('set role authenticated');
    assert.equal((await db.query('select * from public.supplier_directory_categories')).rows.length, 0);
    await db.exec('reset role');
    await asAuthenticated(db, admin, () => db.exec(`update public.supplier_directory_units set active=false
      where id='10000000-0000-0000-0000-000000000001'`));
    await asAuthenticated(db, viewer, async () =>
      assert.equal((await db.query('select * from public.supplier_directory_categories')).rows.length, 0));
  } finally { await db.close(); }
});

test('signup rejects unverified units and user-supplied approval status', async () => {
  const db = await bootstrappedDatabase();
  try {
    await asAuthenticated(db, admin, () => db.exec(`update public.supplier_directory_units set verified=false
      where id='10000000-0000-0000-0000-000000000002'`));
    await asAuthenticated(db, pending, async () => {
      await assert.rejects(db.exec(`insert into public.supplier_directory_profiles(user_id,first_name,last_name,job_title,unit_id,purpose)
        values ('${pending}','Pending','User','Employee','10000000-0000-0000-0000-000000000002','Test access')`), {code: '42501'});
      await assert.rejects(db.exec(`insert into public.supplier_directory_profiles(user_id,first_name,last_name,job_title,unit_id,purpose,status)
        values ('${pending}','Pending','User','Employee','10000000-0000-0000-0000-000000000002','Test access','active')`), {code: '42501'});
    });
  } finally { await db.close(); }
});

test('only admins manage categories and hierarchy cannot exceed two levels', async () => {
  const db = await bootstrappedDatabase();
  try {
    await asAuthenticated(db, viewer, async () => {
      await assert.rejects(db.exec(`insert into public.supplier_directory_categories(name,created_by)
        values ('Unauthorized','${viewer}')`), {code: '42501'});
    });
    await asAuthenticated(db, admin, async () => {
      const child = (await db.query(`insert into public.supplier_directory_categories(name,parent_id,created_by)
        values ('Child','40000000-0000-0000-0000-000000000001','${admin}') returning id`)).rows[0].id;
      await assert.rejects(db.query(`insert into public.supplier_directory_categories(name,parent_id,created_by)
        values ('Grandchild',$1,$2)`, [child, admin]), {code: 'P0001'});
      await assert.rejects(db.query(`update public.supplier_directory_categories set parent_id=$1
        where id='40000000-0000-0000-0000-000000000001'`, [child]), {code: 'P0001'});
      const audit = await db.query("select before_state, after_state from public.supplier_directory_audit where entity_type = 'supplier_directory_profiles'");
      assert.ok(audit.rows.length);
      assert.equal(JSON.stringify(audit.rows).includes('job_title'), false);
      assert.equal(JSON.stringify(audit.rows).includes('first_name'), false);
    });
  } finally { await db.close(); }
});
