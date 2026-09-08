-- Keep class and section placement atomic.

create or replace function public.admin_assign_student_to_section(
  target_student_id uuid,
  target_class_option_id uuid
)
returns public."Student"
language plpgsql
security definer
set search_path = public
as $$
declare
  result public."Student";
  target public."ClassOption";
begin
  if not public.is_admin() then
    raise exception 'only an admin can assign a student to a section';
  end if;

  select *
  into target
  from public."ClassOption"
  where id = target_class_option_id
    and is_active
  for update;

  if target.id is null then
    raise exception 'section is not available';
  end if;

  if target.max_capacity is not null
     and (
       select count(*)
       from public."Student"
       where class_option_id = target.id
         and id <> target_student_id
     ) >= target.max_capacity then
    raise exception 'section is at capacity';
  end if;

  update public."Student"
  set class_id = target.class_id,
      class_option_id = target.id,
      class_locked = true
  where id = target_student_id
  returning * into result;

  if result.id is null then
    raise exception 'student not found';
  end if;

  return result;
end;
$$;

create or replace function public.admin_remove_student_from_class(
  target_student_id uuid
)
returns public."Student"
language plpgsql
security definer
set search_path = public
as $$
declare
  result public."Student";
begin
  if not public.is_admin() then
    raise exception 'only an admin can remove a student from a class';
  end if;

  update public."Student"
  set class_id = null,
      class_option_id = null,
      class_locked = false
  where id = target_student_id
  returning * into result;

  if result.id is null then
    raise exception 'student not found';
  end if;

  return result;
end;
$$;

revoke all on function public.admin_assign_student_to_section(uuid, uuid) from public;
revoke all on function public.admin_remove_student_from_class(uuid) from public;
grant execute on function public.admin_assign_student_to_section(uuid, uuid) to authenticated;
grant execute on function public.admin_remove_student_from_class(uuid) to authenticated;

-- Students may choose a class only while it is unassigned. Admin removal
-- explicitly resets class_locked so the student can choose again.
create or replace function public.lock_student_class()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.class_locked
     and new.class_id is distinct from old.class_id
     and not public.is_admin()
     and not public.is_teacher_for_class(old.class_id) then
    raise exception 'student class is locked; only assigned staff may change it';
  end if;

  if new.class_id is distinct from old.class_id then
    new.class_option_id := null;
  end if;

  if old.class_id is null and new.class_id is not null then
    new.class_locked := true;
  end if;

  if new.class_locked and new.class_id is null then
    raise exception 'a locked student must have a class';
  end if;

  return new;
end;
$$;

-- A teacher may record scores only for a student with a persisted section
-- assignment that belongs to the teacher's form-teacher scope.
drop policy if exists score_write_form_teacher_scope on public."Score";
drop policy if exists score_write_assigned_teacher_scope on public."Score";
drop policy if exists score_write_form_teacher_section_scope on public."Score";
create policy score_write_form_teacher_section_scope on public."Score" for all to authenticated
  using (
    public.is_approved_teacher()
    and exists (
      select 1
      from public."Student" student
      join public."ClassOption" option_row
        on option_row.id = student.class_option_id
      where student.id = "Score".student_id
        and (
          option_row.form_teacher_id = auth.uid()
          or exists (
            select 1
            from public."TeachingSchedule" schedule
            where schedule.teacher_id = auth.uid()
              and schedule.is_form_teacher
              and schedule.class_id = student.class_id
              and (schedule.class_option_id is null or schedule.class_option_id = option_row.id)
          )
        )
    )
    and exists (
      select 1
      from public."Term" term
      where term.id = "Score".term_id
        and term.is_active
    )
  )
  with check (
    public.is_approved_teacher()
    and recorded_by = auth.uid()
    and exists (
      select 1
      from public."Student" student
      join public."ClassOption" option_row
        on option_row.id = student.class_option_id
      where student.id = "Score".student_id
        and (
          option_row.form_teacher_id = auth.uid()
          or exists (
            select 1
            from public."TeachingSchedule" schedule
            where schedule.teacher_id = auth.uid()
              and schedule.is_form_teacher
              and schedule.class_id = student.class_id
              and (schedule.class_option_id is null or schedule.class_option_id = option_row.id)
          )
        )
    )
    and exists (
      select 1
      from public."Term" term
      where term.id = "Score".term_id
        and term.is_active
    )
  );
