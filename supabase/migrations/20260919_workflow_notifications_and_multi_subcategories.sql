-- Multi-select inspection taxonomy and workflow delivery support.
create table if not exists public.inspection_subcategories (
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  subcategory_id uuid not null references public.subcategories(id) on delete restrict,
  primary key (inspection_id, subcategory_id)
);
alter table public.inspection_images add column if not exists subcategory_id uuid references public.subcategories(id) on delete restrict;

alter table public.inspection_subcategories enable row level security;
create policy inspection_subcategories_access on public.inspection_subcategories for select
  using (exists (select 1 from public.inspections i where i.id = inspection_id and public.has_project(i.project_id)));
create index if not exists inspection_subcategories_subcategory_idx on public.inspection_subcategories(subcategory_id);
drop policy if exists settings_read on public.app_settings;
drop policy if exists settings_admin_read on public.app_settings;
create policy settings_admin_read on public.app_settings for select using (public.my_role() in ('ADMIN', 'SUPER_ADMIN'));

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
  if prof.role <> 'CONTRACTOR' then raise exception 'Only Contractor can create inspections'; end if;
  if not exists(select 1 from project_users where user_id = uid and project_id = p_project) then raise exception 'Project access denied'; end if;
  if trim(p_location) = '' or trim(p_description) = '' or coalesce(array_length(p_storage_keys, 1), 0) < 1 then raise exception 'Required fields/photos missing'; end if;
  if not exists(select 1 from categories where id = p_category and is_active) then raise exception 'Invalid category'; end if;
  if coalesce(array_length(p_subcategories, 1), 0) < 1 then raise exception 'At least one subcategory is required'; end if;
  foreach subcategory in array p_subcategories loop
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
