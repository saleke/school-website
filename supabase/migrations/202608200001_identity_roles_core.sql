-- Step 2: identity, roles, and core structural tables.
-- Supabase Auth owns passwords. password_hash is retained for the plan's
-- structural contract and is intentionally NULL for Auth-managed accounts.

create type public.user_role as enum ('student', 'teacher', 'admin', 'alumni');
create type public.teacher_approval_status as enum ('pending', 'approved', 'rejected');

create table public."User" (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  password_hash text,
  role public.user_role not null default 'student',
  is_librarian boolean not null default false,
  teacher_approval_status public.teacher_approval_status,
  created_at timestamptz not null default now(),
  constraint teacher_status_matches_role check (
    (role = 'teacher' and teacher_approval_status is not null)
    or (role <> 'teacher' and teacher_approval_status is null)
  )
);

create table public."Session" (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  start_date date not null,
  end_date date not null,
  constraint session_dates_valid check (end_date >= start_date)
);

create table public."Term" (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public."Session"(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  is_active boolean not null default false,
  unique (session_id, name),
  constraint term_dates_valid check (end_date >= start_date)
);

create table public."Class" (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  grade_level text not null,
  max_capacity integer,
  constraint class_capacity_valid check (max_capacity is null or max_capacity > 0)
);

create table public."Subject" (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  class_id uuid not null references public."Class"(id) on delete cascade,
  unique (name, class_id)
);

create table public."Student" (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public."User"(id) on delete cascade,
  admission_no text unique,
  class_id uuid references public."Class"(id) on delete set null,
  class_locked boolean not null default false,
  dob date
);

create table public."GuardianContact" (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public."Student"(id) on delete cascade,
  name text not null,
  relationship text not null,
  phone text not null,
  email text,
  is_primary boolean not null default false
);

create table public."TeachingSchedule" (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public."User"(id) on delete cascade,
  class_id uuid not null references public."Class"(id) on delete cascade,
  subject_id uuid not null references public."Subject"(id) on delete cascade,
  day_of_week smallint not null,
  start_time time not null,
  end_time time not null,
  is_form_teacher boolean not null default false,
  constraint schedule_day_valid check (day_of_week between 0 and 6),
  constraint schedule_times_valid check (end_time > start_time)
);

create index student_class_idx on public."Student" (class_id);
create index schedule_teacher_idx on public."TeachingSchedule" (teacher_id);
create index schedule_class_idx on public."TeachingSchedule" (class_id);
create index guardian_student_idx on public."GuardianContact" (student_id);
create unique index one_form_teacher_per_class on public."TeachingSchedule" (class_id)
  where is_form_teacher;

-- SECURITY DEFINER helpers keep role checks consistent and avoid policy recursion.
create or replace function public.current_user_role()
returns public.user_role
language sql stable security definer set search_path = public
as $$ select role from public."User" where id = auth.uid() $$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.current_user_role() = 'admin', false) $$;

create or replace function public.has_portal_access()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public."User"
    where id = auth.uid()
      and (role <> 'teacher' or teacher_approval_status = 'approved')
  )
$$;

create or replace function public.is_form_teacher(target_class_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    public.current_user_role() = 'teacher'
    and exists (
      select 1 from public."User" u
      where u.id = auth.uid() and u.teacher_approval_status = 'approved'
    )
    and exists (
      select 1 from public."TeachingSchedule" ts
      where ts.teacher_id = auth.uid() and ts.class_id = target_class_id and ts.is_form_teacher
    ), false
  )
$$;

create or replace function public.is_approved_teacher()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public."User"
    where id = auth.uid() and role = 'teacher' and teacher_approval_status = 'approved'
  )
$$;

-- A student's first non-null class assignment locks the field permanently.
create or replace function public.lock_student_class()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.class_locked and (new.class_id is distinct from old.class_id)
    and not public.is_admin() and not public.is_approved_teacher() then
    raise exception 'student class is locked; only an admin or teacher may change it';
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
create trigger student_class_lock before update on public."Student"
for each row execute function public.lock_student_class();

create or replace function public.enforce_class_capacity()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare capacity integer;
declare enrolled integer;
begin
  if new.class_id is null then return new; end if;
  select max_capacity into capacity from public."Class" where id = new.class_id;
  if capacity is null then return new; end if;
  select count(*) into enrolled from public."Student" where class_id = new.class_id and id <> new.id;
  if enrolled >= capacity then
    raise exception 'class is at capacity';
  end if;
  return new;
end;
$$;
create trigger student_class_capacity before insert or update of class_id on public."Student"
for each row execute function public.enforce_class_capacity();

create or replace function public.validate_schedule_teacher()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public."User" where id = new.teacher_id and role = 'teacher') then
    raise exception 'TeachingSchedule.teacher_id must reference a teacher';
  end if;
  if not exists (select 1 from public."Subject" where id = new.subject_id and class_id = new.class_id) then
    raise exception 'schedule subject must belong to the scheduled class';
  end if;
  return new;
end;
$$;
create trigger schedule_integrity before insert or update on public."TeachingSchedule"
for each row execute function public.validate_schedule_teacher();

-- Keep approval status meaningful and prevent self-service escalation.
create or replace function public.validate_user_role_fields()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.role = 'teacher' and new.teacher_approval_status is null then
    new.teacher_approval_status := 'pending';
  elsif new.role <> 'teacher' then
    new.teacher_approval_status := null;
  end if;
  if tg_op = 'UPDATE' and auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role
      or new.is_librarian is distinct from old.is_librarian
      or new.teacher_approval_status is distinct from old.teacher_approval_status then
      raise exception 'only an admin may change role, librarian, or teacher approval fields';
    end if;
  end if;
  return new;
end;
$$;
create trigger user_role_fields before insert or update on public."User"
for each row execute function public.validate_user_role_fields();

-- Auth signup creates the profile row. Only student/teacher are accepted from
-- signup metadata; admin and alumni can never be selected by a signup form.
create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare requested_role text := coalesce(new.raw_user_meta_data ->> 'role', 'student');
declare safe_role public.user_role := case when requested_role = 'teacher' then 'teacher' else 'student' end;
begin
  insert into public."User" (id, name, email, role, teacher_approval_status)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
          new.email, safe_role, case when safe_role = 'teacher' then 'pending' else null end);
  if safe_role = 'student' then
    insert into public."Student" (user_id) values (new.id);
  end if;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_auth_user_created();

-- Available classes are intentionally capacity-filtered. This is a narrow RPC
-- for profile settings; it does not expose other students' records.
create or replace function public.get_available_classes()
returns table (id uuid, name text, grade_level text, max_capacity integer)
language sql stable security definer set search_path = public
as $$
  select c.id, c.name, c.grade_level, c.max_capacity
  from public."Class" c
  where public.has_portal_access()
    and (c.max_capacity is null
      or (select count(*) from public."Student" s where s.class_id = c.id) < c.max_capacity)
  order by c.grade_level, c.name
$$;
grant execute on function public.get_available_classes() to authenticated;

alter table public."User" enable row level security;
alter table public."Session" enable row level security;
alter table public."Term" enable row level security;
alter table public."Class" enable row level security;
alter table public."Subject" enable row level security;
alter table public."Student" enable row level security;
alter table public."GuardianContact" enable row level security;
alter table public."TeachingSchedule" enable row level security;

create policy user_read_self_or_admin on public."User" for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy user_update_self_or_admin on public."User" for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy session_read_authenticated on public."Session" for select to authenticated using (public.has_portal_access());
create policy session_admin_write on public."Session" for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy term_read_authenticated on public."Term" for select to authenticated using (public.has_portal_access());
create policy term_admin_write on public."Term" for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy class_read_authenticated on public."Class" for select to authenticated using (public.has_portal_access());
create policy class_admin_write on public."Class" for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy subject_read_authenticated on public."Subject" for select to authenticated using (public.has_portal_access());
create policy subject_admin_write on public."Subject" for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy student_read_self_admin_or_form_teacher on public."Student" for select to authenticated
  using (user_id = auth.uid() or public.is_admin() or public.is_form_teacher(class_id));
create policy student_insert_self on public."Student" for insert to authenticated
  with check (user_id = auth.uid());
create policy student_update_self_once_or_staff on public."Student" for update to authenticated
  using (user_id = auth.uid() and not class_locked or public.is_admin() or public.is_approved_teacher())
  with check (user_id = auth.uid() or public.is_admin() or public.is_approved_teacher());

create policy guardian_read_owner_admin_form_teacher on public."GuardianContact" for select to authenticated
  using (exists (select 1 from public."Student" s where s.id = student_id and
    (public.is_admin() or public.is_form_teacher(s.class_id))));
create policy guardian_insert_owner on public."GuardianContact" for insert to authenticated
  with check (exists (select 1 from public."Student" s where s.id = student_id and s.user_id = auth.uid()));
create policy guardian_update_owner_or_admin on public."GuardianContact" for update to authenticated
  using (exists (select 1 from public."Student" s where s.id = student_id and (s.user_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public."Student" s where s.id = student_id and (s.user_id = auth.uid() or public.is_admin())));
create policy guardian_delete_owner_or_admin on public."GuardianContact" for delete to authenticated
  using (exists (select 1 from public."Student" s where s.id = student_id and (s.user_id = auth.uid() or public.is_admin())));

create policy schedule_admin_manage on public."TeachingSchedule" for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy schedule_teacher_read_own on public."TeachingSchedule" for select to authenticated
  using (teacher_id = auth.uid() and public.is_approved_teacher());
