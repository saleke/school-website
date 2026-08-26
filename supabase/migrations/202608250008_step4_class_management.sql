-- Stage 4 foundation: Class is the year group; ClassOption is A-D.
-- This migration is intentionally editable because it has not been applied.

alter table public."Class" add column if not exists is_active boolean not null default true;

create table public."ClassOption" (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public."Class"(id) on delete cascade,
  code text not null check (code in ('A', 'B', 'C', 'D')),
  max_capacity integer check (max_capacity is null or max_capacity > 0),
  form_teacher_id uuid references public."User"(id) on delete set null,
  is_active boolean not null default true,
  unique (class_id, code)
);

-- Preserve one seeded row per year group, then remove the other section rows.
create temporary table class_normalization as
select grade_level, min(id::text)::uuid as keep_id
from public."Class"
where grade_level in ('JSS1','JSS2','JSS3','SSS1','SSS2','SSS3')
group by grade_level;

-- This is an administrative remap of legacy JSS1A-style rows. Suspend the
-- existing class-lock trigger only for the migration; it is recreated below.
drop trigger if exists student_class_lock on public."Student";

delete from public."Subject" subject
using public."Class" class, class_normalization normal
where subject.class_id = class.id and class.grade_level = normal.grade_level and class.id <> normal.keep_id;
delete from public."TeachingSchedule" schedule
using public."Class" class, class_normalization normal
where schedule.class_id = class.id and class.grade_level = normal.grade_level and class.id <> normal.keep_id;
update public."Student" student set class_id = normal.keep_id
from public."Class" class, class_normalization normal
where student.class_id = class.id and class.grade_level = normal.grade_level and class.id <> normal.keep_id;
delete from public."Class" class using class_normalization normal
where class.grade_level = normal.grade_level and class.id <> normal.keep_id;
update public."Class" class set name = normal.grade_level, grade_level = normal.grade_level
from class_normalization normal where class.id = normal.keep_id;

insert into public."Class" (name, grade_level) values
 ('JSS1','JSS1'),('JSS2','JSS2'),('JSS3','JSS3'),
 ('SSS1','SSS1'),('SSS2','SSS2'),('SSS3','SSS3')
on conflict (name) do update set grade_level = excluded.grade_level;

insert into public."ClassOption" (class_id, code)
select class.id, option.code from public."Class" class
cross join (values ('A'), ('B'), ('C'), ('D')) option(code)
where class.name in ('JSS1','JSS2','JSS3','SSS1','SSS2','SSS3')
on conflict do nothing;

alter table public."Student"
  add column if not exists class_option_id uuid references public."ClassOption"(id) on delete set null;
create index if not exists student_class_option_idx on public."Student" (class_option_id);
create index if not exists class_option_form_teacher_idx on public."ClassOption" (form_teacher_id);

create or replace function public.validate_student_class_option()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.class_option_id is not null and not exists (
    select 1 from public."ClassOption" opt
    where opt.id = new.class_option_id and opt.class_id = new.class_id and opt.is_active
  ) then raise exception 'class option must belong to the student class'; end if;
  return new;
end; $$;
create trigger student_class_option_integrity before insert or update on public."Student"
for each row execute function public.validate_student_class_option();

create or replace function public.validate_class_option_teacher()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.form_teacher_id is not null and not exists (
    select 1 from public."User" where id = new.form_teacher_id
      and role = 'teacher' and teacher_approval_status = 'approved'
  ) then raise exception 'form teacher must be an approved teacher'; end if;
  return new;
end; $$;
create trigger class_option_teacher_integrity before insert or update on public."ClassOption"
for each row execute function public.validate_class_option_teacher();

alter table public."ClassOption" enable row level security;
create policy class_option_read_authenticated on public."ClassOption" for select to authenticated
  using (public.has_portal_access());
create policy class_option_admin_write on public."ClassOption" for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant select on public."ClassOption" to authenticated;
grant insert, update, delete on public."ClassOption" to authenticated;

create or replace function public.is_form_teacher_for_option(target_option_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public."ClassOption" opt join public."User" teacher on teacher.id = opt.form_teacher_id
    where opt.id = target_option_id and teacher.id = auth.uid()
      and teacher.role = 'teacher' and teacher.teacher_approval_status = 'approved'
  )
$$;

create or replace function public.select_student_class_option(target_option_id uuid)
returns public."Student" language plpgsql security definer set search_path = public as $$
declare result public."Student"; target public."ClassOption";
begin
  select * into result from public."Student" where user_id = auth.uid() for update;
  if result.id is null or result.class_id is null then raise exception 'select a class before selecting an option'; end if;
  if result.class_option_id is not null then raise exception 'class option has already been selected'; end if;
  select * into target from public."ClassOption"
    where id = target_option_id and class_id = result.class_id and is_active for update;
  if target.id is null then raise exception 'option is not available for this class'; end if;
  if target.max_capacity is not null and
    (select count(*) from public."Student" where class_option_id = target.id) >= target.max_capacity
    then raise exception 'class option is at capacity'; end if;
  update public."Student" set class_option_id = target.id where id = result.id returning * into result;
  return result;
end; $$;
revoke all on function public.select_student_class_option(uuid) from public;
grant execute on function public.select_student_class_option(uuid) to authenticated;

-- Promotion can update class_id and clear class_option_id in one transaction.
-- The actual batch promotion workflow remains deferred to Step 18.
create or replace function public.lock_student_class()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.class_locked and new.class_id is distinct from old.class_id
     and not public.is_admin() and not public.is_teacher_for_class(old.class_id) then
    raise exception 'student class is locked; only assigned staff may change it';
  end if;
  if new.class_id is distinct from old.class_id then new.class_option_id := null; end if;
  if old.class_id is null and new.class_id is not null then new.class_locked := true; end if;
  if new.class_locked and new.class_id is null then raise exception 'a locked student must have a class'; end if;
  return new;
end; $$;
create trigger student_class_lock before update on public."Student"
for each row execute function public.lock_student_class();

drop policy if exists score_write_form_teacher_scope on public."Score";
create policy score_write_form_teacher_scope on public."Score" for all to authenticated
  using (public.is_approved_teacher()
    and exists (select 1 from public."Student" s where s.id = student_id and public.is_form_teacher_for_option(s.class_option_id))
    and exists (select 1 from public."Term" t where t.id = term_id and t.is_active))
  with check (public.is_approved_teacher() and recorded_by = auth.uid()
    and exists (select 1 from public."Student" s where s.id = student_id and public.is_form_teacher_for_option(s.class_option_id))
    and exists (select 1 from public."Term" t where t.id = term_id and t.is_active));
