-- Convert legacy elevated profiles to the single supported administrator role.
update public.profiles
set role = 'ADMIN'::public.app_role
where role::text = 'SUPER_ADMIN';
