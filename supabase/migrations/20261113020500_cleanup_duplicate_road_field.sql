-- Consolidate the known extraction duplicate before category seeding. Refuse to
-- discard conflicting memberships or changed source records; a person must review them.
do $$
declare
  duplicate_id constant uuid := '3dfb2369-695b-47ed-9a52-d255a245bfa3';
  kept_id constant uuid := 'e744ea22-d6d2-4f2f-9ca6-1c77cf148f15';
begin
  if not exists (select 1 from public.registry_fields where id = duplicate_id) then return; end if;
  if not exists (
    select 1 from public.registry_fields d join public.registry_fields k on k.registry_id = d.registry_id
    where d.id = duplicate_id and k.id = kept_id
      and d.source_text = 'ניהול פרויקטים, אינסטלציה, תיאום תשתיות, כמאי, מהנדס דרכים, תנועה, כבישים וחניי ה'
      and k.source_text = 'ניהול פרויקטים, אינסטלציה, תיאום תשתיות, כמאי, מהנדס דרכים, תנועה, כבישים וחנייה'
      and d.source_code is not distinct from k.source_code
  ) then raise exception 'Road-field snapshot differs; review before cleanup'; end if;
  if exists (
    select 1 from public.memberships d join public.memberships k
      on k.supplier_id = d.supplier_id and k.registry_version_id = d.registry_version_id
    where d.registry_field_id = duplicate_id and k.registry_field_id = kept_id
  ) then raise exception 'Conflicting memberships require manual review'; end if;
  insert into public.registry_field_categories (registry_field_id, category_id, created_at, created_by)
    select kept_id, category_id, created_at, created_by from public.registry_field_categories
    where registry_field_id = duplicate_id on conflict (registry_field_id, category_id) do nothing;
  update public.memberships set registry_field_id = kept_id where registry_field_id = duplicate_id;
  update public.registry_fields set category_id = null where id = duplicate_id;
  delete from public.registry_field_categories where registry_field_id = duplicate_id;
  delete from public.registry_fields where id = duplicate_id;
end;
$$;
