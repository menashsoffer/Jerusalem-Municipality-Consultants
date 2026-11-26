-- Popular searches on the home screen (Menash, 26.11.2026: "לגבי מה נפוץ אני בעד"). A search is
-- counted anonymously: the table holds the words and a daily count, never who searched or when
-- within the day. Words with a digit are not kept, so an ID or a phone number is never stored.
-- Rows older than 90 days are removed on the next search.

create table private.search_terms (
  term text not null check (char_length(term) between 2 and 40),
  day date not null,
  hits integer not null default 1 check (hits > 0),
  primary key (term, day)
);
create index search_terms_day on private.search_terms (day);

revoke all on table private.search_terms from public, anon, authenticated;

/** Lower case, inner spaces folded, ends trimmed; null when the words must not be kept. */
create or replace function private.search_term(raw text)
returns text language sql immutable set search_path = '' as $$
  select case
    when t is null or char_length(t) not between 2 and 40 or t ~ '[0-9]' then null
    else t
  end
  from (select lower(regexp_replace(btrim(raw), '\s+', ' ', 'g')) as t) x
$$;

revoke all on function private.search_term(text) from public, anon, authenticated;

create or replace function public.record_search(query text)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  clean text := private.search_term(query);
  today date := private.israel_today();
begin
  if not (private.is_admin() or private.is_member()) then
    raise exception 'Only active members record searches' using errcode = '42501';
  end if;
  if clean is null then
    return;
  end if;
  insert into private.search_terms as s (term, day) values (clean, today)
    on conflict (term, day) do update set hits = s.hits + 1;
  delete from private.search_terms where day < today - 90;
end
$$;

revoke all on function public.record_search(text) from public, anon;
grant execute on function public.record_search(text) to authenticated;

/** The three words searched most in the last 30 days, each at least 3 times. */
create or replace function private.popular_searches(today date)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('term', x.term, 'count', x.n)
    order by x.n desc, x.term), '[]'::jsonb)
  from (
    select term, sum(hits)::int as n
    from private.search_terms
    where day > today - 30
    group by term
    having sum(hits) >= 3
    order by n desc, term
    limit 3
  ) x
$$;

revoke all on function private.popular_searches(date) from public, anon, authenticated;

create or replace function public.home_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  admin boolean := private.is_admin();
  result jsonb;
begin
  if not (admin or private.is_member()) then
    raise exception 'Only active members see the overview' using errcode = '42501';
  end if;
  result := jsonb_build_object(
    'active_suppliers', (select count(*) from public.suppliers where status = 'active'),
    'registries', (select count(*) from public.registries where status = 'active'),
    'memberships', (select count(*) from public.memberships where review_status <> 'rejected'),
    'memberships_verified', (select count(*) from public.memberships
      where review_status = 'verified'),
    'suppliers_identified', (select count(distinct i.supplier_id)
      from public.supplier_identifiers i
      join public.suppliers s on s.id = i.supplier_id and s.status = 'active'
      where i.review_status = 'verified'),
    'my_open_requests', (select count(*) from public.engagement_requests e
      where e.status in ('draft', 'submitted', 'approved')
        and (admin or private.in_unit(e.unit_id))),
    'requests_to_award', private.requests_to_award(admin),
    'lapsed', private.lapsed_registrations(private.israel_today()),
    'popular_searches', private.popular_searches(private.israel_today()));
  if admin then
    result := result || jsonb_build_object(
      'kind_suggestions_pending', (select count(*) from public.kind_suggestions
        where status = 'pending'),
      'registries_without_unit', (select count(*) from public.registries
        where status = 'active' and owner_unit_id is null));
  end if;
  return result;
end
$$;

revoke all on function public.home_overview() from public, anon;
grant execute on function public.home_overview() to authenticated;
