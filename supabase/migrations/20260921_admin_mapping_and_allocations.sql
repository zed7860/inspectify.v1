-- Apply after 20260919_workflow_notifications_and_multi_subcategories.sql.
begin;
create or replace function public.import_category_mapping(p_rows jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare item jsonb; cid uuid;
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 1 and 2000 then raise exception 'Invalid mapping rows'; end if;
  perform pg_advisory_xact_lock(hashtext('category_mapping_import'));
  for item in select value from jsonb_array_elements(p_rows) loop
    if coalesce(length(trim(item->>'category')),0) not between 1 and 200 or coalesce(length(trim(item->>'subcategory')),0) not between 1 and 200 then raise exception 'Category and subcategory names are required'; end if;
    insert into categories(name) values(trim(item->>'category')) on conflict(name) do nothing;
    select id into cid from categories where name=trim(item->>'category');
    insert into subcategories(category_id,name) values(cid,trim(item->>'subcategory')) on conflict(category_id,name) do nothing;
  end loop;
end $$;
revoke all on function public.import_category_mapping(jsonb) from public, anon, authenticated;
grant execute on function public.import_category_mapping(jsonb) to service_role;

create or replace function public.allocate_project_users(p_project uuid,p_users uuid[])
returns void language plpgsql security definer set search_path=public as $$
begin
  perform 1 from projects where id=p_project for update;
  if not found then raise exception 'Project not found'; end if;
  if p_users is null or exists(select 1 from unnest(p_users) uid where uid is null or not exists(select 1 from profiles where id=uid)) then raise exception 'Invalid user selection'; end if;
  delete from project_users where project_id=p_project and not(user_id=any(p_users));
  insert into project_users(project_id,user_id) select p_project,unnest(p_users) on conflict do nothing;
end $$;
revoke all on function public.allocate_project_users(uuid,uuid[]) from public, anon, authenticated;
grant execute on function public.allocate_project_users(uuid,uuid[]) to service_role;

create or replace function public.has_project(pid uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from profiles p where p.id=auth.uid() and p.is_active and (p.role='ADMIN' or exists(select 1 from project_users pu where pu.user_id=p.id and pu.project_id=pid)))
$$;
create or replace function public.submit_inspection(
  p_project uuid,
  p_category uuid,
  p_subcategories uuid[],
  p_location text,
  p_description text,
  p_storage_keys text[],
  p_names text[],
  p_mimes text[],
  p_sizes bigint[],
  p_image_subcategories uuid[]
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  uid uuid := auth.uid();
  iid uuid;
  rid uuid;
  subcategory uuid;
  i int;
  prof profiles%rowtype;
begin
  select * into prof from profiles where id = uid and is_active = true;
  if prof.role is distinct from 'CONTRACTOR' then raise exception 'Only Contractor can create inspections'; end if;
  if not exists(select 1 from project_users where user_id = uid and project_id = p_project) then raise exception 'Project access denied'; end if;
  if trim(p_location) = '' or trim(p_description) = '' or coalesce(array_length(p_storage_keys, 1), 0) < 1 then raise exception 'Required fields/photos missing'; end if;
  if not exists(select 1 from categories where id = p_category and is_active) then raise exception 'Invalid category'; end if;
  if coalesce(array_length(p_subcategories, 1), 0) < 1 then raise exception 'At least one subcategory is required'; end if;
  if cardinality(p_storage_keys) is distinct from cardinality(p_names)
    or cardinality(p_storage_keys) is distinct from cardinality(p_mimes)
    or cardinality(p_storage_keys) is distinct from cardinality(p_sizes)
    or cardinality(p_storage_keys) is distinct from cardinality(p_image_subcategories)
    then raise exception 'Invalid evidence mapping'; end if;
  if exists(select 1 from unnest(p_image_subcategories) sid where sid is null or not(sid=any(p_subcategories))) then raise exception 'Evidence must belong to selected subcategories'; end if;
  foreach subcategory in array p_subcategories loop
    if not(subcategory=any(p_image_subcategories)) then raise exception 'Add evidence for every selected subcategory'; end if;
    if not exists(select 1 from subcategories where id = subcategory and category_id = p_category and is_active) then raise exception 'Invalid subcategory'; end if;
  end loop;

  insert into inspections(inspection_number, project_id, contractor_id, category_id, subcategory_id, location, status, current_revision, submitted_at)
  values(new_inspection_number(), p_project, uid, p_category, p_subcategories[1], p_location, 'PENDING_PMC', 0, now()) returning id into iid;
  foreach subcategory in array p_subcategories loop
    insert into inspection_subcategories(inspection_id, subcategory_id) values(iid, subcategory);
  end loop;
  insert into inspection_revisions(inspection_id, revision_no, description, submitted_by) values(iid, 0, p_description, uid) returning id into rid;
  for i in 1..array_length(p_storage_keys, 1) loop
    insert into inspection_images(inspection_id, revision_id, subcategory_id, stage, uploaded_by, storage_key, original_filename, mime_type, size_bytes)
    values(iid, rid, p_image_subcategories[i], 'CONTRACTOR', uid, p_storage_keys[i], p_names[i], p_mimes[i], p_sizes[i]);
  end loop;
  insert into inspection_events(inspection_id, revision_id, actor_id, actor_name, actor_role, action, new_status)
  values(iid, rid, uid, prof.name, prof.role, 'SUBMIT_INSPECTION', 'PENDING_PMC');
  return iid;
end;
$$;

commit;
