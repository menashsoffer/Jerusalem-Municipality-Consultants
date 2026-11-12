-- DRAFT: isolated test only. Do not apply to production before review.
-- The existing public.suppliers table and its policies live in Supabase and are not
-- versioned here yet. The web client currently sends created_by and review_status
-- itself, so any signed-in user able to insert could spoof both. This guard moves
-- those two values to the database and leaves the existing policies untouched.
-- Assumes public.suppliers already has created_by uuid and review_status text.

begin;

create schema if not exists supplier_directory_private;
revoke all on schema supplier_directory_private from public, anon, authenticated;

create function supplier_directory_private.guard_supplier_write()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- Only end-user roles are restricted. Service and migration roles keep full control.
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
    new.review_status := 'needs_review';
    return new;
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by cannot be changed' using errcode = '42501';
  end if;
  if new.review_status is distinct from old.review_status then
    raise exception 'review_status is set by the review process only' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function supplier_directory_private.guard_supplier_write() from public, anon, authenticated;

create trigger suppliers_write_guard before insert or update on public.suppliers
  for each row execute function supplier_directory_private.guard_supplier_write();

commit;
