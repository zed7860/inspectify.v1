begin;
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
commit;
