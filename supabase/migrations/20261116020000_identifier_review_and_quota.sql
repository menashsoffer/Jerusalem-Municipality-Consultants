-- Bound expensive registry lookups per signed-in user. The Edge Function makes
-- this call with the caller's token before contacting any external service.
create function public.identifier_lookup_authorize()
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode = 'PT401'; end if;
  if not private.has_role(array['editor', 'unit_manager']) then
    raise exception 'Not authorized' using errcode = 'PT403';
  end if;
  if not private.take_quota('identifier_lookup', 20, interval '1 hour') then
    raise exception 'Too many identifier lookups' using errcode = 'PT429';
  end if;
end;
$$;
revoke all on function public.identifier_lookup_authorize() from public, anon;
grant execute on function public.identifier_lookup_authorize() to authenticated;

-- A lookup is only a proposal. Even privileged background code cannot mark a
-- newly inserted or unreviewed identifier verified without an authenticated person.
create function private.guard_identifier_approval()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.review_status = 'verified' and (tg_op = 'INSERT' or old.review_status <> 'verified') then
    if tg_op = 'INSERT' or auth.uid() is null or new.created_by is null
      or auth.uid() = new.created_by then
      raise exception 'Identifier approval requires a different signed-in reviewer' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_identifier_approval() from public, anon, authenticated;
create trigger identifier_approval before insert or update on public.supplier_identifiers
  for each row execute function private.guard_identifier_approval();

-- An explicit decision, not a lookup, changes a pending candidate's status.
revoke update (review_status) on public.supplier_identifiers from authenticated;
create function public.decide_supplier_identifier(target uuid, approve boolean)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.has_role(array['unit_manager']) then
    raise exception 'Only a signed-in manager or admin can review identifiers' using errcode = '42501';
  end if;
  if approve is null then raise exception 'Decision required' using errcode = '22023'; end if;
  update public.supplier_identifiers set review_status = case when approve then 'verified' else 'rejected' end
  where id = target and review_status = 'needs_review' and created_by is not null and created_by <> auth.uid();
  if not found then raise exception 'Candidate unavailable or reviewer is the submitter' using errcode = '22023'; end if;
end;
$$;
revoke all on function public.decide_supplier_identifier(uuid, boolean) from public, anon;
grant execute on function public.decide_supplier_identifier(uuid, boolean) to authenticated;
