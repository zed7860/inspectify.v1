-- Inspectifier database update.
-- Run this after supabase/schema.sql. It is safe to run more than once.

create table if not exists public.inspection_subcategories (
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  subcategory_id uuid not null references public.subcategories(id) on delete restrict,
  primary key (inspection_id, subcategory_id)
);
alter table public.inspection_images add column if not exists subcategory_id uuid references public.subcategories(id) on delete restrict;

create index if not exists inspection_subcategories_subcategory_idx
  on public.inspection_subcategories(subcategory_id);

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_users enable row level security;
alter table public.project_companies enable row level security;
alter table public.categories enable row level security;
alter table public.subcategories enable row level security;
alter table public.inspections enable row level security;
alter table public.inspection_subcategories enable row level security;
alter table public.inspection_revisions enable row level security;
alter table public.inspection_images enable row level security;
alter table public.reviews enable row level security;
alter table public.inspection_events enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.app_settings enable row level security;

create or replace function public.my_role()
returns public.app_role
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() and is_active = true $$;

create or replace function public.has_project(pid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.my_role() in ('ADMIN', 'SUPER_ADMIN')
    or exists (select 1 from public.project_users where user_id = auth.uid() and project_id = pid)
$$;

-- Policies are dropped first so this script can be safely rerun.
drop policy if exists profiles_self on public.profiles;
drop policy if exists projects_access on public.projects;
drop policy if exists categories_read on public.categories;
drop policy if exists subcategories_read on public.subcategories;
drop policy if exists companies_read on public.companies;
drop policy if exists project_users_read on public.project_users;
drop policy if exists inspections_access on public.inspections;
drop policy if exists inspection_subcategories_access on public.inspection_subcategories;
drop policy if exists revisions_access on public.inspection_revisions;
drop policy if exists images_access on public.inspection_images;
drop policy if exists reviews_access on public.reviews;
drop policy if exists events_access on public.inspection_events;
drop policy if exists notifications_own on public.notifications;
drop policy if exists notifications_update on public.notifications;
drop policy if exists admin_audit on public.audit_logs;
drop policy if exists settings_read on public.app_settings;
drop policy if exists settings_admin_read on public.app_settings;

create policy profiles_self on public.profiles for select
  using (id = auth.uid() or public.my_role() in ('ADMIN', 'SUPER_ADMIN'));
create policy projects_access on public.projects for select
  using (public.has_project(id));
create policy categories_read on public.categories for select
  using (auth.uid() is not null);
create policy subcategories_read on public.subcategories for select
  using (auth.uid() is not null);
create policy companies_read on public.companies for select
  using (auth.uid() is not null);
create policy project_users_read on public.project_users for select
  using (user_id = auth.uid() or public.my_role() in ('ADMIN', 'SUPER_ADMIN'));
create policy inspections_access on public.inspections for select
  using (public.has_project(project_id));
create policy inspection_subcategories_access on public.inspection_subcategories for select
  using (exists (select 1 from public.inspections i where i.id = inspection_id and public.has_project(i.project_id)));
create policy revisions_access on public.inspection_revisions for select
  using (exists (select 1 from public.inspections i where i.id = inspection_id and public.has_project(i.project_id)));
create policy images_access on public.inspection_images for select
  using (exists (select 1 from public.inspections i where i.id = inspection_id and public.has_project(i.project_id)));
create policy reviews_access on public.reviews for select
  using (exists (select 1 from public.inspections i where i.id = inspection_id and public.has_project(i.project_id)));
create policy events_access on public.inspection_events for select
  using (exists (select 1 from public.inspections i where i.id = inspection_id and public.has_project(i.project_id)));
create policy notifications_own on public.notifications for select
  using (user_id = auth.uid());
create policy notifications_update on public.notifications for update
  using (user_id = auth.uid());
create policy admin_audit on public.audit_logs for select
  using (public.my_role() in ('ADMIN', 'SUPER_ADMIN'));
create policy settings_admin_read on public.app_settings for select
  using (public.my_role() in ('ADMIN', 'SUPER_ADMIN'));

create or replace function public.submit_inspection(
  p_project uuid,
  p_category uuid,
  p_subcategories uuid[],
  p_location text,
  p_description text,
  p_storage_keys text[],
  p_names text[],
  p_mimes text[],
  p_sizes bigint[]
  ,p_image_subcategories uuid[]
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  iid uuid;
  rid uuid;
  subcategory uuid;
  i int;
  prof public.profiles%rowtype;
begin
  select * into prof from public.profiles where id = uid and is_active = true;
  if prof.role is null or prof.role <> 'CONTRACTOR' then raise exception 'Only Contractor can create inspections'; end if;
  if not exists (select 1 from public.project_users where user_id = uid and project_id = p_project) then raise exception 'Project access denied'; end if;
  if trim(p_location) = '' or trim(p_description) = '' or coalesce(array_length(p_storage_keys, 1), 0) < 1 then raise exception 'Required fields/photos missing'; end if;
  if not exists (select 1 from public.categories where id = p_category and is_active = true) then raise exception 'Invalid category'; end if;
  if coalesce(array_length(p_subcategories, 1), 0) < 1 then raise exception 'At least one subcategory is required'; end if;

  foreach subcategory in array p_subcategories loop
    if not exists (select 1 from public.subcategories where id = subcategory and category_id = p_category and is_active = true) then raise exception 'Invalid subcategory'; end if;
  end loop;

  insert into public.inspections(inspection_number, project_id, contractor_id, category_id, subcategory_id, location, status, current_revision, submitted_at)
  values (public.new_inspection_number(), p_project, uid, p_category, p_subcategories[1], p_location, 'PENDING_PMC', 0, now())
  returning id into iid;

  foreach subcategory in array p_subcategories loop
    insert into public.inspection_subcategories(inspection_id, subcategory_id)
    values (iid, subcategory)
    on conflict do nothing;
  end loop;

  insert into public.inspection_revisions(inspection_id, revision_no, description, submitted_by)
  values (iid, 0, p_description, uid) returning id into rid;

  for i in 1..array_length(p_storage_keys, 1) loop
    insert into public.inspection_images(inspection_id, revision_id, subcategory_id, stage, uploaded_by, storage_key, original_filename, mime_type, size_bytes)
    values (iid, rid, p_image_subcategories[i], 'CONTRACTOR', uid, p_storage_keys[i], p_names[i], p_mimes[i], p_sizes[i]);
  end loop;

  insert into public.inspection_events(inspection_id, revision_id, actor_id, actor_name, actor_role, action, new_status)
  values (iid, rid, uid, prof.name, prof.role, 'SUBMIT_INSPECTION', 'PENDING_PMC');
  return iid;
end;
$$;

-- Application writes use SECURITY DEFINER RPCs or the server service-role client.
