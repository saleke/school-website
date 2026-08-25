-- Final Step 2 hardening. Apply after 202608200001_identity_roles_core.sql
-- (and 202608200002 only when that repair was required).

-- Remove the broad grants/policies from the initial migration before applying
-- the least-privilege rules below.
revoke all on public."User", public."Session", public."Term", public."Class",
  public."Subject", public."Student", public."GuardianContact",
  public."TeachingSchedule" from authenticated;

drop policy if exists user_update_self_or_admin on public."User";
create policy user_update_self_or_admin on public."User" for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create or replace function public.is_teacher_for_class(target_class_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public."TeachingSchedule" ts
    join public."User" u on u.id = ts.teacher_id
    where ts.class_id = target_class_id and ts.teacher_id = auth.uid()
      and u.role = 'teacher' and u.teacher_approval_status = 'approved'
  )
$$;

drop policy if exists student_insert_self on public."Student";
drop policy if exists student_update_self_once_or_staff on public."Student";
drop policy if exists student_staff_update on public."Student";
create policy student_staff_update on public."Student" for update to authenticated
  using (public.is_admin() or public.is_teacher_for_class(class_id))
  with check (public.is_admin() or public.is_teacher_for_class(class_id));

create or replace function public.lock_student_class()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if old.class_locked and new.class_id is distinct from old.class_id
     and not public.is_admin() and not public.is_teacher_for_class(old.class_id) then
    raise exception 'student class is locked; only an assigned teacher or admin may change it';
  end if;
  if old.class_id is null and new.class_id is not null then new.class_locked := true; end if;
  if new.class_locked and new.class_id is null then raise exception 'a locked student must have a class'; end if;
  return new;
end;
$$;

create or replace function public.select_student_class(target_class_id uuid)
returns public."Student" language plpgsql security definer set search_path = public
as $$
declare result public."Student";
begin
  if public.current_user_role() <> 'student' then raise exception 'only students can make an initial class selection'; end if;
  select * into result from public."Student" where user_id = auth.uid() for update;
  if result.id is null then raise exception 'student profile not found'; end if;
  if result.class_locked or result.class_id is not null then raise exception 'class selection is already locked'; end if;
  perform 1 from public."Class" where id = target_class_id for update;
  if not exists (select 1 from public."Class" c where c.id = target_class_id and
    (c.max_capacity is null or (select count(*) from public."Student" s where s.class_id = c.id) < c.max_capacity))
    then raise exception 'class is unavailable or at capacity'; end if;
  update public."Student" set class_id = target_class_id, class_locked = true
    where id = result.id returning * into result;
  return result;
end;
$$;
revoke all on function public.select_student_class(uuid) from public;
grant execute on function public.select_student_class(uuid) to authenticated;

-- Explicit least-privilege grants for PostgREST.
grant select on public."User", public."Session", public."Term", public."Class",
  public."Subject", public."Student", public."GuardianContact",
  public."TeachingSchedule" to authenticated;
grant update on public."User" to authenticated;
grant update on public."Student" to authenticated;
grant insert, update, delete on public."GuardianContact" to authenticated;
grant insert, update, delete on public."Session", public."Term", public."Class",
  public."Subject", public."TeachingSchedule" to authenticated;

drop policy if exists guardian_read_owner_admin_form_teacher on public."GuardianContact";
create policy guardian_read_owner_admin_form_teacher on public."GuardianContact" for select to authenticated
  using (exists (select 1 from public."Student" s where s.id = student_id
    and (s.user_id = auth.uid() or public.is_admin() or public.is_form_teacher(s.class_id))));
