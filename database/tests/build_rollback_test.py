#!/usr/bin/env python3
"""Build a transactional RLS test for an isolated Supabase test project.

The generated SQL always ends in ROLLBACK. It must not be run against the live
project: use an isolated test project or a disposable local Supabase instance.
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / 'drafts/202611120001_directory_access.sql'
OUTPUT = ROOT / 'tests/generated_access_rollback.sql'

TEST = r'''
-- Test fixtures refer to an existing auth identity but modify only new tables.
do $$
declare uid uuid;
begin
  select id into uid from auth.users order by created_at limit 1;
  if uid is null then raise exception 'Test requires one existing auth user'; end if;
  perform set_config('directory_test.user_id', uid::text, true);
  insert into public.supplier_directory_units(id, name, kind, active, verified)
    values ('10000000-0000-0000-0000-000000000001', 'Test administration', 'administration', true, true);
  insert into public.supplier_directory_units(id, name, kind, parent_id, active, verified)
    values ('10000000-0000-0000-0000-000000000002', 'Test department', 'department',
            '10000000-0000-0000-0000-000000000001', true, true);
  insert into public.supplier_directory_profiles(user_id, first_name, last_name, job_title, unit_id,
      purpose, status, reviewed_at, reviewed_by)
    values (uid, 'Test', 'User', 'Test', '10000000-0000-0000-0000-000000000002',
            'Testing only', 'active', now(), uid);
  insert into public.supplier_directory_roles(user_id, role, granted_by) values (uid, 'admin', uid);
  insert into public.supplier_directory_categories(name, created_by) values ('Test category', uid);
  if has_table_privilege('anon', 'public.supplier_directory_categories', 'select') then
    raise exception 'Anonymous role has category select';
  end if;
  if has_column_privilege('authenticated', 'public.supplier_directory_profiles', 'status', 'insert') then
    raise exception 'Users can insert an approved profile';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', current_setting('directory_test.user_id'), 'role', 'authenticated', 'is_anonymous', false)::text, true);
do $$ begin
  if not supplier_directory_private.is_admin() or not supplier_directory_private.active_user() then
    raise exception 'Active administrator was denied';
  end if;
  if (select count(*) from public.supplier_directory_categories) <> 1 then
    raise exception 'Active administrator cannot read categories';
  end if;
  if (select count(*) from public.supplier_directory_audit) < 5 then
    raise exception 'Audit entries were not created';
  end if;
end $$;

-- An identity with no profile or role must not see categories or submit a request.
select set_config('request.jwt.claims', '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false}', true);
do $$ begin
  if supplier_directory_private.active_user() then raise exception 'Unknown user has access'; end if;
  if (select count(*) from public.supplier_directory_categories) <> 0 then
    raise exception 'Unknown user can see categories';
  end if;
  begin
    insert into public.supplier_directory_category_requests(requested_by, proposed_name, description)
      values ('20000000-0000-0000-0000-000000000001', 'Unauthorized', 'Should be denied');
    raise exception 'Unknown user submitted a category request';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select set_config('request.jwt.claims', json_build_object(
  'sub', current_setting('directory_test.user_id'), 'role', 'authenticated', 'is_anonymous', false)::text, true);
update public.supplier_directory_roles set revoked_at = now()
  where user_id = current_setting('directory_test.user_id')::uuid and role = 'admin';
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', current_setting('directory_test.user_id'), 'role', 'authenticated', 'is_anonymous', false)::text, true);
do $$ begin
  if supplier_directory_private.active_user() or supplier_directory_private.is_admin() then
    raise exception 'Revoked role still has access';
  end if;
  if (select count(*) from public.supplier_directory_categories) <> 0 then
    raise exception 'Revoked user can still see categories';
  end if;
end $$;
reset role;
rollback;
select 'rollback test passed; all fixtures reverted' as result;
'''


def main():
    migration = MIGRATION.read_text(encoding='utf-8')
    if not migration.rstrip().endswith('commit;'):
        raise ValueError('Unexpected migration ending')
    sql = migration.rstrip()[:-len('commit;')] + TEST
    OUTPUT.write_text(sql, encoding='utf-8')
    print(f'Generated test SQL at {OUTPUT}; no changes were made to a database.')


if __name__ == '__main__':
    main()
