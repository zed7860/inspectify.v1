-- INSPECTIFIER: SINGLE UPDATE FILE FOR YOUR EXISTING SUPABASE PROJECT
-- Paste this ENTIRE file into Supabase Dashboard -> SQL Editor -> New query -> Run.
-- This includes all updates discussed: multi-subcategory evidence, optional review photos,
-- project allocation, user names/usernames/deletion, RLS and duplicate category overrides.
-- Prerequisite: your existing app database (schema.sql already installed).
-- Do not rerun schema.sql or seed.sql on your existing database.
-- Safe to rerun this file. All updates commit together, or roll back together on error.
-- Existing users, inspections, photographs and record IDs are retained.
-- This script does not send email, reset passwords, or set your public website domain.
begin;

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



-- 20260918_admin_only.sql
-- Convert legacy elevated profiles to the single supported administrator role.
update public.profiles
set role = 'ADMIN'::public.app_role
where role::text = 'SUPER_ADMIN';

-- 20260918_optional_review_photos.sql
-- Review photos are optional; comments remain required.
create or replace function public.review_inspection(
  p_inspection uuid,
  p_stage review_stage,
  p_decision decision,
  p_comments text,
  p_reason text,
  p_expected_version int,
  p_storage_keys text[],
  p_names text[],
  p_mimes text[],
  p_sizes bigint[]
) returns void
language plpgsql security definer set search_path=public as $$
declare
  uid uuid := auth.uid();
  prof profiles%rowtype;
  ins inspections%rowtype;
  rid uuid;
  ns inspection_status;
  i int;
begin
  select * into prof from profiles where id = uid and is_active = true;
  select * into ins from inspections where id = p_inspection for update;
  if not found then raise exception 'Inspection not found'; end if;
  if ins.lock_version <> p_expected_version then raise exception 'This inspection has already been reviewed. Refresh to see the latest status.'; end if;
  if not exists(select 1 from project_users where user_id = uid and project_id = ins.project_id) and prof.role not in ('ADMIN','SUPER_ADMIN') then raise exception 'Project access denied'; end if;
  if trim(p_comments) = '' then raise exception 'Review comments are required'; end if;
  if p_stage = 'PMC' then
    if prof.role not in ('PMC','ADMIN','SUPER_ADMIN') or ins.status not in ('PENDING_PMC','RESUBMITTED') then raise exception 'Invalid PMC review'; end if;
    ns := case when p_decision = 'APPROVED' then 'PENDING_CLIENT' else 'PMC_REJECTED' end;
  else
    if prof.role not in ('CLIENT','ADMIN','SUPER_ADMIN') or ins.status <> 'PENDING_CLIENT' then raise exception 'Invalid Client review'; end if;
    ns := case when p_decision = 'APPROVED' then 'FINAL_APPROVED' else 'CLIENT_REJECTED' end;
  end if;
  select id into rid from inspection_revisions where inspection_id = ins.id and revision_no = ins.current_revision;
  insert into reviews(inspection_id,revision_id,stage,reviewer_id,decision,comments,rejection_reason,previous_status,new_status)
  values(ins.id,rid,p_stage,uid,p_decision,p_comments,nullif(trim(p_reason),''),ins.status,ns);
  for i in 1..coalesce(array_length(p_storage_keys,1),0) loop
    insert into inspection_images(inspection_id,revision_id,stage,uploaded_by,storage_key,original_filename,mime_type,size_bytes)
    values(ins.id,rid,p_stage::text::image_stage,uid,p_storage_keys[i],p_names[i],p_mimes[i],p_sizes[i]);
  end loop;
  update inspections set status = ns, lock_version = lock_version + 1, final_approved_at = case when ns = 'FINAL_APPROVED' then now() else final_approved_at end where id = ins.id;
  insert into inspection_events(inspection_id,revision_id,actor_id,actor_name,actor_role,action,previous_status,new_status,details)
  values(ins.id,rid,uid,prof.name,prof.role,p_stage::text || '_' || p_decision::text,ins.status,ns,jsonb_build_object('comments',p_comments,'reason',p_reason));
end$$;

-- 20260921_admin_mapping_and_allocations.sql
-- Apply after 20260919_workflow_notifications_and_multi_subcategories.sql.
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


-- 20260921_usernames_and_account_deletion.sql
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists deleted_at timestamptz;
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format check (username is null or username ~ '^[a-z0-9][a-z0-9._-]{2,29}$');
create unique index if not exists profiles_username_unique on public.profiles(lower(username)) where username is not null;

-- Supabase Auth soft deletion and directory removal commit together.
-- Keep profile IDs for inspection/review history, but release login identifiers.
create or replace function public.archive_deleted_auth_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  update profiles set is_active=false, deleted_at=new.deleted_at, username=null,
    email='deleted+' || new.id::text || '@deleted.invalid', phone=null
  where id=new.id;
  delete from project_users where user_id=new.id;
  return new;
end $$;
revoke all on function public.archive_deleted_auth_user() from public, anon, authenticated;
drop trigger if exists archive_deleted_auth_user on auth.users;
create trigger archive_deleted_auth_user after update of deleted_at on auth.users
for each row when (new.deleted_at is not null and old.deleted_at is null)
execute function public.archive_deleted_auth_user();

-- 20260921_category_overrides.sql
-- Repeated names overwrite the existing entry, preserving IDs and inspection history.
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


-- Private evidence storage
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('inspection-evidence','inspection-evidence',false,10485760,array['image/jpeg','image/png','image/webp']) on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;
-- Signed URLs are created by trusted server routes. Uploads also go through authenticated server routes.


notify pgrst, 'reload schema';
commit;
