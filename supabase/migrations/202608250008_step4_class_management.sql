-- Step 4 class-management foundation.
-- Class sections remain stable reference rows (JSS1A, SSS3D, etc.), while
-- activation and pastoral ownership are managed independently of timetables.

alter table public."Class"
  add column if not exists is_active boolean not null default true,
  add column if not exists form_teacher_id uuid references public."User"(id) on delete set null,
  add column if not exists dorm_teacher_id uuid references public."User"(id) on delete set null;

create index if not exists class_form_teacher_idx on public."Class" (form_teacher_id);
create index if not exists class_dorm_teacher_idx on public."Class" (dorm_teacher_id);

create or replace function public.validate_class_teachers()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.form_teacher_id is not null and not exists (
    select 1 from public."User" where id = new.form_teacher_id
      and role = 'teacher' and teacher_approval_status = 'approved'
  ) then raise exception 'form teacher must be an approved teacher'; end if;
  if new.dorm_teacher_id is not null and not exists (
    select 1 from public."User" where id = new.dorm_teacher_id
      and role = 'teacher' and teacher_approval_status = 'approved'
  ) then raise exception 'dorm teacher must be an approved teacher'; end if;
  return new;
end;
$$;
drop trigger if exists class_teacher_integrity on public."Class";
create trigger class_teacher_integrity before insert or update on public."Class"
for each row execute function public.validate_class_teachers();

drop policy if exists class_admin_write on public."Class";
create policy class_admin_write on public."Class" for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Form-teacher ownership is now a class property, not a timetable flag.
create or replace function public.is_form_teacher(target_class_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public."Class" where id = target_class_id and form_teacher_id = auth.uid()) $$;

create or replace function public.is_teacher_for_class(target_class_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public."Class" c
    where c.id = target_class_id and c.form_teacher_id = auth.uid()
  ) or exists (
    select 1 from public."TeachingSchedule" ts
    where ts.class_id = target_class_id and ts.teacher_id = auth.uid()
  )
$$;

drop policy if exists score_write_form_teacher_scope on public."Score";
create policy score_write_form_teacher_scope on public."Score" for all to authenticated
  using (public.is_approved_teacher() and public.is_form_teacher((select class_id from public."Student" where id = student_id)) and exists (select 1 from public."TeachingSchedule" ts where ts.class_id = (select class_id from public."Student" where id = student_id) and ts.subject_id = public."Score".subject_id and ts.teacher_id = auth.uid()) and exists (select 1 from public."Term" t where t.id = public."Score".term_id and t.is_active))
  with check (public.is_approved_teacher() and recorded_by = auth.uid() and public.is_form_teacher((select class_id from public."Student" where id = student_id)) and exists (select 1 from public."TeachingSchedule" ts where ts.class_id = (select class_id from public."Student" where id = student_id) and ts.subject_id = public."Score".subject_id and ts.teacher_id = auth.uid()) and exists (select 1 from public."Term" t where t.id = public."Score".term_id and t.is_active));
