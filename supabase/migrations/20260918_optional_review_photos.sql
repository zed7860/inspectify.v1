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
