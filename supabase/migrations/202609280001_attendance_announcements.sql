-- Attendance, Announcements, and Assignments tables with RLS.
-- These tables support the core school day workflow.

-- ============================================
-- ATTENDANCE
-- ============================================

create table public."AttendanceRecord" (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public."Student"(id) on delete cascade,
  date date not null,
  status text not null check (status in ('present', 'absent', 'late')),
  recorded_by uuid not null references public."User"(id),
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (student_id, date)
);

create index attendance_student_idx on public."AttendanceRecord" (student_id);
create index attendance_date_idx on public."AttendanceRecord" (date);
create index attendance_class_date_idx on public."AttendanceRecord" (student_id, date);

alter table public."AttendanceRecord" enable row level security;

-- Students can read their own attendance
create policy attendance_read_self on public."AttendanceRecord" for select to authenticated
  using (exists (select 1 from public."Student" s where s.id = student_id and s.user_id = auth.uid()));

-- Teachers can read attendance for their assigned classes
create policy attendance_read_assigned_teacher on public."AttendanceRecord" for select to authenticated
  using (public.is_approved_teacher() and exists (
    select 1 from public."Student" s
    join public."TeachingSchedule" ts on ts.class_id = s.class_id
    where s.id = "AttendanceRecord".student_id
      and ts.teacher_id = auth.uid()
      and (ts.class_option_id is null or ts.class_option_id = s.class_option_id)
  ));

-- Admins can read all attendance
create policy attendance_read_admin on public."AttendanceRecord" for select to authenticated
  using (public.is_admin());

-- Teachers can insert/update attendance for their assigned classes, same-day only
create policy attendance_write_assigned_teacher on public."AttendanceRecord" for all to authenticated
  using (
    public.is_approved_teacher()
    and exists (
      select 1 from public."Student" s
      join public."TeachingSchedule" ts on ts.class_id = s.class_id
      where s.id = "AttendanceRecord".student_id
        and ts.teacher_id = auth.uid()
        and (ts.class_option_id is null or ts.class_option_id = s.class_option_id)
    )
    and "AttendanceRecord".date = current_date
  )
  with check (
    public.is_approved_teacher()
    and recorded_by = auth.uid()
    and exists (
      select 1 from public."Student" s
      join public."TeachingSchedule" ts on ts.class_id = s.class_id
      where s.id = "AttendanceRecord".student_id
        and ts.teacher_id = auth.uid()
        and (ts.class_option_id is null or ts.class_option_id = s.class_option_id)
    )
    and "AttendanceRecord".date = current_date
  );

grant select, insert, update on public."AttendanceRecord" to authenticated;

-- ============================================
-- ANNOUNCEMENTS
-- ============================================

create table public."Announcement" (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  scope text not null check (scope in ('school', 'grade', 'class')),
  target_id uuid,
  author_id uuid not null references public."User"(id),
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index announcement_scope_idx on public."Announcement" (scope, target_id);
create index announcement_published_idx on public."Announcement" (published_at desc);

alter table public."Announcement" enable row level security;

-- All portal users can read school-wide announcements
create policy announcement_read_school on public."Announcement" for select to authenticated
  using (scope = 'school' and public.has_portal_access());

-- Grade-level announcements
create policy announcement_read_grade on public."Announcement" for select to authenticated
  using (
    scope = 'grade'
    and public.has_portal_access()
    and exists (
      select 1 from public."Student" s
      join public."Class" c on c.id = s.class_id
      where s.user_id = auth.uid()
        and c.grade_level = public."Announcement".target_id::text
    )
  );

-- Class-level announcements
create policy announcement_read_class on public."Announcement" for select to authenticated
  using (
    scope = 'class'
    and public.has_portal_access()
    and exists (
      select 1 from public."Student" s
      where s.user_id = auth.uid()
        and s.class_id = public."Announcement".target_id
    )
  );

-- Teachers and admins can create announcements
create policy announcement_insert_staff on public."Announcement" for insert to authenticated
  with check (public.is_admin() or public.is_approved_teacher());

-- Only author or admin can update
create policy announcement_update_author on public."Announcement" for update to authenticated
  using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());

-- Only author or admin can delete
create policy announcement_delete_author on public."Announcement" for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

grant select, insert, update, delete on public."Announcement" to authenticated;

-- ============================================
-- ASSIGNMENTS
-- ============================================

create table public."Assignment" (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  subject_id uuid not null references public."Subject"(id) on delete cascade,
  class_id uuid not null references public."Class"(id) on delete cascade,
  class_option_id uuid references public."ClassOption"(id) on delete set null,
  teacher_id uuid not null references public."User"(id),
  due_date timestamptz not null,
  max_score numeric(5,2) not null default 100 check (max_score > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index assignment_class_idx on public."Assignment" (class_id, class_option_id);
create index assignment_teacher_idx on public."Assignment" (teacher_id);
create index assignment_due_idx on public."Assignment" (due_date);

alter table public."Assignment" enable row level security;

-- Students can read assignments for their class
create policy assignment_read_student on public."Assignment" for select to authenticated
  using (exists (
    select 1 from public."Student" s
    where s.user_id = auth.uid()
      and s.class_id = "Assignment".class_id
      and ("Assignment".class_option_id is null or "Assignment".class_option_id = s.class_option_id)
  ));

-- Teachers can read assignments they created or for their classes
create policy assignment_read_teacher on public."Assignment" for select to authenticated
  using (
    public.is_approved_teacher()
    and (
      teacher_id = auth.uid()
      or exists (
        select 1 from public."TeachingSchedule" ts
        where ts.teacher_id = auth.uid()
          and ts.class_id = "Assignment".class_id
          and ("Assignment".class_option_id is null or "Assignment".class_option_id = ts.class_option_id)
      )
    )
  );

-- Admins can read all
create policy assignment_read_admin on public."Assignment" for select to authenticated
  using (public.is_admin());

-- Teachers can create assignments for their classes
create policy assignment_insert_teacher on public."Assignment" for insert to authenticated
  with check (
    public.is_approved_teacher()
    and teacher_id = auth.uid()
    and exists (
      select 1 from public."TeachingSchedule" ts
      where ts.teacher_id = auth.uid()
        and ts.class_id = "Assignment".class_id
        and ("Assignment".class_option_id is null or "Assignment".class_option_id = ts.class_option_id)
    )
  );

-- Teachers can update their own assignments
create policy assignment_update_teacher on public."Assignment" for update to authenticated
  using (teacher_id = auth.uid() and public.is_approved_teacher())
  with check (teacher_id = auth.uid() and public.is_approved_teacher());

-- Teachers can delete their own assignments
create policy assignment_delete_teacher on public."Assignment" for delete to authenticated
  using (teacher_id = auth.uid() and public.is_approved_teacher());

grant select, insert, update, delete on public."Assignment" to authenticated;

-- ============================================
-- ASSIGNMENT SUBMISSIONS
-- ============================================

create table public."AssignmentSubmission" (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public."Assignment"(id) on delete cascade,
  student_id uuid not null references public."Student"(id) on delete cascade,
  content text not null default '',
  file_url text,
  submitted_at timestamptz not null default now(),
  score numeric(5,2),
  feedback text,
  graded_at timestamptz,
  graded_by uuid references public."User"(id),
  unique (assignment_id, student_id)
);

create index submission_assignment_idx on public."AssignmentSubmission" (assignment_id);
create index submission_student_idx on public."AssignmentSubmission" (student_id);

alter table public."AssignmentSubmission" enable row level security;

-- Students can read their own submissions
create policy submission_read_self on public."AssignmentSubmission" for select to authenticated
  using (exists (select 1 from public."Student" s where s.id = student_id and s.user_id = auth.uid()));

-- Teachers can read submissions for their assignments
create policy submission_read_teacher on public."AssignmentSubmission" for select to authenticated
  using (public.is_approved_teacher() and exists (
    select 1 from public."Assignment" a
    where a.id = assignment_id
      and (a.teacher_id = auth.uid() or exists (
        select 1 from public."TeachingSchedule" ts
        where ts.teacher_id = auth.uid()
          and ts.class_id = a.class_id
          and (a.class_option_id is null or a.class_option_id = ts.class_option_id)
      ))
  ));

-- Admins can read all
create policy submission_read_admin on public."AssignmentSubmission" for select to authenticated
  using (public.is_admin());

-- Students can submit their own work
create policy submission_insert_self on public."AssignmentSubmission" for insert to authenticated
  with check (exists (
    select 1 from public."Student" s
    where s.id = student_id
      and s.user_id = auth.uid()
      and exists (
        select 1 from public."Assignment" a
        where a.id = assignment_id
          and a.class_id = s.class_id
          and (a.class_option_id is null or a.class_option_id = s.class_option_id)
      )
  ));

-- Students can update their own submissions (before grading)
create policy submission_update_self on public."AssignmentSubmission" for update to authenticated
  using (exists (select 1 from public."Student" s where s.id = student_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public."Student" s where s.id = student_id and s.user_id = auth.uid()));

-- Teachers can grade submissions
create policy submission_grade_teacher on public."AssignmentSubmission" for update to authenticated
  using (public.is_approved_teacher() and exists (
    select 1 from public."Assignment" a
    where a.id = assignment_id
      and (a.teacher_id = auth.uid() or exists (
        select 1 from public."TeachingSchedule" ts
        where ts.teacher_id = auth.uid()
          and ts.class_id = a.class_id
          and (a.class_option_id is null or a.class_option_id = ts.class_option_id)
      ))
  ))
  with check (public.is_approved_teacher() and exists (
    select 1 from public."Assignment" a
    where a.id = assignment_id
      and (a.teacher_id = auth.uid() or exists (
        select 1 from public."TeachingSchedule" ts
        where ts.teacher_id = auth.uid()
          and ts.class_id = a.class_id
          and (a.class_option_id is null or a.class_option_id = ts.class_option_id)
      ))
  ));

grant select, insert, update on public."AssignmentSubmission" to authenticated;
