-- Supplier edit checks, stage 3 contract (documentation/supplier-edit-checks-spec-he.md, 6.3).
-- The edit dialog now saves through submit_supplier_change, which checks every change first.
-- The older write functions let a signed-in editor skip those checks.
-- update_supplier has no caller left, so it goes.
drop function public.update_supplier(jsonb);

-- rename_supplier and replace_supplier_contact stay for apply_supplier_change, which runs
-- them as the owner once a change passed or was approved. Nobody else may call them. They
-- keep their own role and rule checks.
revoke execute on function public.rename_supplier(jsonb), public.replace_supplier_contact(jsonb)
  from public, anon, authenticated;
