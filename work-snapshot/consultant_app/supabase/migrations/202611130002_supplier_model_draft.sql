-- DRAFT for isolated tests only. Does not modify the existing suppliers table.
-- Requires 202611120001_directory_access_draft.sql first.
begin;

create function supplier_directory_private.can_edit_unit(target_unit uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select supplier_directory_private.is_admin() or exists (
    select 1 from public.supplier_directory_profiles p
    join public.supplier_directory_roles r on r.user_id=p.user_id
    join public.supplier_directory_units u on u.id=r.unit_id
    join public.supplier_directory_units parent on parent.id=u.parent_id
    where p.user_id=(select auth.uid()) and p.status='active'
      and coalesce((select auth.jwt())->>'is_anonymous','false')<>'true'
      and r.role in ('editor','department_manager') and r.unit_id=target_unit
      and r.granted_at<=now() and r.revoked_at is null and (r.expires_at is null or r.expires_at>now())
      and u.kind='department' and u.active and u.verified
      and parent.kind='administration' and parent.active and parent.verified
  );
$$;
revoke all on function supplier_directory_private.can_edit_unit(uuid) from public, anon, authenticated;
grant execute on function supplier_directory_private.can_edit_unit(uuid) to authenticated;

create table public.supplier_directory_entities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 200),
  owner_unit_id uuid not null references public.supplier_directory_units(id),
  phone text check (length(phone)<=80),
  email text check (length(email)<=320),
  review_status text not null default 'pending' check (review_status in ('pending','published','rejected')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id), reviewed_at timestamptz,
  check ((review_status='pending' and reviewed_by is null and reviewed_at is null)
    or (review_status<>'pending' and reviewed_by is not null and reviewed_at is not null))
);
create index directory_entities_name_idx on public.supplier_directory_entities(lower(name));

create table public.supplier_directory_sources (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 2 and 300),
  source_url text not null check (source_url ~ '^https://'),
  owner_unit_id uuid not null references public.supplier_directory_units(id),
  published_on date, valid_from date, valid_until date,
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
  check (valid_from is null or valid_until is null or valid_from<=valid_until),
  unique (source_url, owner_unit_id)
);

create table public.supplier_directory_memberships (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.supplier_directory_entities(id),
  source_id uuid references public.supplier_directory_sources(id),
  owner_unit_id uuid not null references public.supplier_directory_units(id),
  original_name text, original_field text,
  source_page integer check (source_page>0), source_row text,
  valid_from date, valid_until date,
  review_status text not null default 'pending' check (review_status in ('pending','published','rejected')),
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id), reviewed_at timestamptz,
  check (valid_from is null or valid_until is null or valid_from<=valid_until),
  check ((review_status='pending' and reviewed_by is null and reviewed_at is null)
    or (review_status<>'pending' and reviewed_by is not null and reviewed_at is not null)),
  check (source_id is not null or (source_page is null and source_row is null))
);
create index directory_memberships_entity_idx on public.supplier_directory_memberships(entity_id);
-- A row locator is evidence, not a unique identity: some PDFs contain multiple tables per page.
create index directory_source_row_idx on public.supplier_directory_memberships(source_id,source_page,source_row);

create table public.supplier_directory_membership_categories (
  membership_id uuid not null references public.supplier_directory_memberships(id),
  category_id uuid not null references public.supplier_directory_categories(id),
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
  primary key (membership_id, category_id)
);
create index directory_membership_category_lookup on public.supplier_directory_membership_categories(category_id,membership_id);

alter table public.supplier_directory_entities enable row level security;
alter table public.supplier_directory_sources enable row level security;
alter table public.supplier_directory_memberships enable row level security;
alter table public.supplier_directory_membership_categories enable row level security;
revoke all on public.supplier_directory_entities, public.supplier_directory_sources,
  public.supplier_directory_memberships, public.supplier_directory_membership_categories from public, anon, authenticated;
grant select on public.supplier_directory_entities, public.supplier_directory_sources,
  public.supplier_directory_memberships, public.supplier_directory_membership_categories to authenticated;
grant insert(name,owner_unit_id,phone,email,created_by) on public.supplier_directory_entities to authenticated;
grant insert(title,source_url,owner_unit_id,published_on,valid_from,valid_until,created_by) on public.supplier_directory_sources to authenticated;
grant insert(entity_id,source_id,owner_unit_id,original_name,original_field,source_page,source_row,valid_from,valid_until,created_by)
  on public.supplier_directory_memberships to authenticated;
grant insert(membership_id,category_id,created_by) on public.supplier_directory_membership_categories to authenticated;
-- Admin moderation is intentionally separate from user-controlled creation.
grant update(review_status,reviewed_by,reviewed_at) on public.supplier_directory_entities, public.supplier_directory_memberships to authenticated;

create policy directory_entities_read on public.supplier_directory_entities for select to authenticated
  using (((select supplier_directory_private.active_user()) and review_status='published')
    or supplier_directory_private.can_edit_unit(owner_unit_id));
create policy directory_entities_create on public.supplier_directory_entities for insert to authenticated
  with check (created_by=(select auth.uid()) and review_status='pending' and supplier_directory_private.can_edit_unit(owner_unit_id));
create policy directory_entities_moderate on public.supplier_directory_entities for update to authenticated
  using ((select supplier_directory_private.is_admin()) and review_status='pending')
  with check ((select supplier_directory_private.is_admin()) and reviewed_by=(select auth.uid()) and review_status in ('published','rejected'));

create policy directory_sources_read on public.supplier_directory_sources for select to authenticated
  using ((select supplier_directory_private.active_user()));
create policy directory_sources_create on public.supplier_directory_sources for insert to authenticated
  with check (created_by=(select auth.uid()) and supplier_directory_private.can_edit_unit(owner_unit_id));

create policy directory_memberships_read on public.supplier_directory_memberships for select to authenticated
  using (((select supplier_directory_private.active_user()) and review_status='published'
      and exists (select 1 from public.supplier_directory_entities e where e.id=entity_id and e.review_status='published'))
    or supplier_directory_private.can_edit_unit(owner_unit_id));
create policy directory_memberships_create on public.supplier_directory_memberships for insert to authenticated
  with check (created_by=(select auth.uid()) and review_status='pending' and supplier_directory_private.can_edit_unit(owner_unit_id)
    and exists (select 1 from public.supplier_directory_entities e where e.id=supplier_directory_memberships.entity_id)
    and (source_id is null or exists (select 1 from public.supplier_directory_sources s where s.id=source_id and s.owner_unit_id=supplier_directory_memberships.owner_unit_id))); 
create policy directory_memberships_moderate on public.supplier_directory_memberships for update to authenticated
  using ((select supplier_directory_private.is_admin()) and review_status='pending')
  with check ((select supplier_directory_private.is_admin()) and reviewed_by=(select auth.uid()) and review_status in ('published','rejected'));
create policy directory_membership_categories_read on public.supplier_directory_membership_categories for select to authenticated
  using (exists (select 1 from public.supplier_directory_memberships m where m.id=membership_id));
create policy directory_membership_categories_create on public.supplier_directory_membership_categories for insert to authenticated
  with check (created_by=(select auth.uid()) and exists
    (select 1 from public.supplier_directory_memberships m where m.id=membership_id and m.review_status='pending'
      and supplier_directory_private.can_edit_unit(m.owner_unit_id))
    and exists (select 1 from public.supplier_directory_categories c where c.id=category_id and c.active));

-- Log identifiers and review state only, never copy supplier contact details.
create function supplier_directory_private.record_supplier_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare old_state jsonb; new_state jsonb; record_id uuid;
begin
  if tg_table_name='supplier_directory_membership_categories' then
    record_id := new.membership_id;
    new_state := jsonb_build_object('category_id',new.category_id);
  else
    new_state := jsonb_build_object('owner_unit_id',(to_jsonb(new)->>'owner_unit_id'),
      'review_status',(to_jsonb(new)->>'review_status'));
    record_id := (to_jsonb(new)->>'id')::uuid;
    if tg_op='UPDATE' then
      old_state := jsonb_build_object('owner_unit_id',(to_jsonb(old)->>'owner_unit_id'),
        'review_status',(to_jsonb(old)->>'review_status'));
    end if;
  end if;
  insert into public.supplier_directory_audit(actor_id,entity_type,entity_id,operation,before_state,after_state)
  values ((select auth.uid()),tg_table_name,record_id,tg_op,old_state,new_state);
  return new;
end;
$$;
revoke all on function supplier_directory_private.record_supplier_change() from public, anon, authenticated;
create trigger directory_entities_audit after insert or update on public.supplier_directory_entities
  for each row execute function supplier_directory_private.record_supplier_change();
create trigger directory_sources_audit after insert or update on public.supplier_directory_sources
  for each row execute function supplier_directory_private.record_supplier_change();
create trigger directory_memberships_audit after insert or update on public.supplier_directory_memberships
  for each row execute function supplier_directory_private.record_supplier_change();
create trigger directory_membership_categories_audit after insert on public.supplier_directory_membership_categories
  for each row execute function supplier_directory_private.record_supplier_change();

commit;
