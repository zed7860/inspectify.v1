-- Repeated names overwrite the existing entry, preserving IDs and inspection history.
begin;
create or replace function public.import_category_mapping(p_rows jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare item jsonb; cid uuid;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 1 and 2000 then raise exception 'Invalid mapping rows'; end if;
  perform pg_advisory_xact_lock(hashtext('category_mapping_import'));
  for item in select value from jsonb_array_elements(p_rows) loop
    if coalesce(length(trim(item->>'category')),0) not between 1 and 200 or coalesce(length(trim(item->>'subcategory')),0) not between 1 and 200 then raise exception 'Category and subcategory names are required'; end if;
    insert into categories(name,is_active) values(trim(item->>'category'),true)
    on conflict(name) do update set name=excluded.name,is_active=true returning id into cid;
    insert into subcategories(category_id,name,is_active) values(cid,trim(item->>'subcategory'),true)
    on conflict(category_id,name) do update set name=excluded.name,is_active=true;
  end loop;
end $$;
revoke all on function public.import_category_mapping(jsonb) from public, anon, authenticated;
grant execute on function public.import_category_mapping(jsonb) to service_role;

commit;
