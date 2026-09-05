-- Assessment entry is restricted to the form teacher of the student's section.
-- Teachers may still manage rosters through the separate staff-scoped policies.

drop policy if exists score_write_assigned_teacher_scope on public."Score";
drop policy if exists score_write_form_teacher_section_scope on public."Score";
create policy score_write_form_teacher_section_scope on public."Score" for all to authenticated
  using (
    public.is_approved_teacher()
    and exists (
      select 1
      from public."Student" student
      join public."ClassOption" option_row on option_row.id = student.class_option_id
      where student.id = "Score".student_id
        and option_row.form_teacher_id = auth.uid()
    )
    and exists (
      select 1
      from public."Term" term
      where term.id = "Score".term_id and term.is_active
    )
  )
  with check (
    public.is_approved_teacher()
    and recorded_by = auth.uid()
    and exists (
      select 1
      from public."Student" student
      join public."ClassOption" option_row on option_row.id = student.class_option_id
      where student.id = "Score".student_id
        and option_row.form_teacher_id = auth.uid()
    )
    and exists (
      select 1
      from public."Term" term
      where term.id = "Score".term_id and term.is_active
    )
  );

drop policy if exists student_read_assigned_teacher on public."Student";
drop policy if exists student_read_form_teacher on public."Student";
create policy student_read_form_teacher on public."Student" for select to authenticated
  using (
    exists (
      select 1
      from public."ClassOption" option_row
      where option_row.id = "Student".class_option_id
        and option_row.form_teacher_id = auth.uid()
    )
    or exists (
      select 1
      from public."TeachingSchedule" schedule
      where schedule.teacher_id = auth.uid()
        and schedule.is_form_teacher
        and schedule.class_id = "Student".class_id
        and (schedule.class_option_id is null or schedule.class_option_id = "Student".class_option_id)
    )
  );

drop policy if exists user_read_assigned_teacher on public."User";
drop policy if exists user_read_form_teacher on public."User";
create policy user_read_form_teacher on public."User" for select to authenticated
  using (
    exists (
      select 1
      from public."Student" student
      where student.user_id = "User".id
        and (
          exists (
            select 1 from public."ClassOption" option_row
            where option_row.id = student.class_option_id
              and option_row.form_teacher_id = auth.uid()
          )
          or exists (
            select 1 from public."TeachingSchedule" schedule
            where schedule.teacher_id = auth.uid()
              and schedule.is_form_teacher
              and schedule.class_id = student.class_id
              and (schedule.class_option_id is null or schedule.class_option_id = student.class_option_id)
          )
        )
    )
  );



