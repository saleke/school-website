-- Allow assigned teachers to work with every scheduled section, not only
-- form-teacher sections. The UI still receives only rows allowed by these
-- policies.

drop policy if exists score_write_form_teacher_scope on public."Score";
drop policy if exists score_write_assigned_teacher_scope on public."Score";
create policy score_write_assigned_teacher_scope on public."Score" for all to authenticated
  using (
    public.is_approved_teacher()
    and exists (
      select 1
      from public."Student" student
      join public."TeachingSchedule" schedule
        on schedule.teacher_id = auth.uid()
       and schedule.class_id = student.class_id
       and schedule.subject_id = "Score".subject_id
       and (schedule.class_option_id is null or schedule.class_option_id = student.class_option_id)
      where student.id = "Score".student_id
    )
    and exists (select 1 from public."Term" term where term.id = "Score".term_id and term.is_active)
  )
  with check (
    public.is_approved_teacher()
    and recorded_by = auth.uid()
    and exists (
      select 1
      from public."Student" student
      join public."TeachingSchedule" schedule
        on schedule.teacher_id = auth.uid()
       and schedule.class_id = student.class_id
       and schedule.subject_id = "Score".subject_id
       and (schedule.class_option_id is null or schedule.class_option_id = student.class_option_id)
      where student.id = "Score".student_id
    )
    and exists (select 1 from public."Term" term where term.id = "Score".term_id and term.is_active)
  );

drop policy if exists student_read_assigned_teacher on public."Student";
create policy student_read_assigned_teacher on public."Student" for select to authenticated
  using (
    exists (
      select 1 from public."TeachingSchedule" schedule
      where schedule.teacher_id = auth.uid()
        and schedule.class_id = "Student".class_id
        and (schedule.class_option_id is null or schedule.class_option_id = "Student".class_option_id)
    )
  );

drop policy if exists student_update_self_once_or_staff on public."Student";
create policy student_update_self_once_or_staff on public."Student" for update to authenticated
  using (
    (user_id = auth.uid() and not class_locked)
    or public.is_admin()
    or public.is_approved_teacher()
  )
  with check (
    user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public."TeachingSchedule" schedule
      where schedule.teacher_id = auth.uid()
        and schedule.class_id = "Student".class_id
        and (schedule.class_option_id is null or schedule.class_option_id = "Student".class_option_id)
    )
  );

drop policy if exists user_read_assigned_teacher on public."User";
create policy user_read_assigned_teacher on public."User" for select to authenticated
  using (
    exists (
      select 1
      from public."Student" student
      join public."TeachingSchedule" schedule
        on schedule.teacher_id = auth.uid()
       and schedule.class_id = student.class_id
       and (schedule.class_option_id is null or schedule.class_option_id = student.class_option_id)
      where student.user_id = "User".id
    )
  );
