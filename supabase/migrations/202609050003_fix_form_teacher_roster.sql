-- Return the complete roster to the form teacher through a narrowly scoped
-- function. This avoids losing students through nested User RLS joins.


create or replace function public.get_form_teacher_roster(target_class_option_id uuid)
returns table (
  id uuid,
  user_id uuid,
  class_id uuid,
  class_option_id uuid,
  class_locked boolean,
  name text,
  email text
)
language sql
stable
security definer
set search_path = public
as $$
  select student.id,
    student.user_id,
    student.class_id,
    student.class_option_id,
    student.class_locked,
    profile.name,
    profile.email
  from public."Student" student
  join public."User" profile on profile.id = student.user_id
  join public."ClassOption" option_row
    on option_row.id = target_class_option_id
  where (
    option_row.form_teacher_id = auth.uid()
    or exists (
      select 1
      from public."TeachingSchedule" schedule
      where schedule.teacher_id = auth.uid()
        and schedule.is_form_teacher
        and schedule.class_id = option_row.class_id
        and (schedule.class_option_id is null or schedule.class_option_id = option_row.id)
    )
  )
  and student.class_id = option_row.class_id
  and (student.class_option_id = target_class_option_id or student.class_option_id is null)
  order by profile.name, profile.email;
$$;

revoke all on function public.get_form_teacher_roster(uuid) from public;
grant execute on function public.get_form_teacher_roster(uuid) to authenticated;

drop policy if exists score_write_form_teacher_section_scope on public."Score";
create policy score_write_form_teacher_section_scope on public."Score" for all to authenticated
  using (
    public.is_approved_teacher()
    and exists (
      select 1
      from public."Student" student
      join public."ClassOption" option_row on option_row.id = student.class_option_id
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
    and exists (select 1 from public."Term" term where term.id = "Score".term_id and term.is_active)
  )
  with check (
    public.is_approved_teacher()
    and recorded_by = auth.uid()
    and exists (
      select 1
      from public."Student" student
      join public."ClassOption" option_row on option_row.id = student.class_option_id
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
    and exists (select 1 from public."Term" term where term.id = "Score".term_id and term.is_active)
  );

