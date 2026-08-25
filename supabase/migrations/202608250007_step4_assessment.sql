-- Step 4 assessment engine.
create table public."AssessmentType" (
  id uuid primary key default gen_random_uuid(), name text not null,
  weight_pct numeric(5,2) not null check (weight_pct >= 0 and weight_pct <= 100),
  max_score numeric(5,2) not null check (max_score > 0 and max_score <= 100),
  subject_id uuid not null references public."Subject"(id) on delete cascade,
  unique (name, subject_id)
);
create table public."Score" (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public."Student"(id) on delete cascade,
  subject_id uuid not null references public."Subject"(id) on delete cascade,
  term_id uuid not null references public."Term"(id) on delete cascade,
  assessment_type_id uuid not null references public."AssessmentType"(id) on delete cascade,
  raw_score numeric(5,2) not null check (raw_score >= 0), recorded_at timestamptz not null default now(), recorded_by uuid not null references public."User"(id),
  unique (student_id, subject_id, term_id, assessment_type_id)
);
create table public."TermResultSnapshot" (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public."Student"(id) on delete cascade,
  subject_id uuid references public."Subject"(id) on delete cascade, term_id uuid not null references public."Term"(id) on delete cascade,
  weighted_average numeric(6,2) not null check (weighted_average >= 0 and weighted_average <= 100), class_position integer, cohort_size integer, computed_at timestamptz not null default now(),
  unique (student_id, subject_id, term_id)
);
alter table public."AssessmentType" enable row level security; alter table public."Score" enable row level security; alter table public."TermResultSnapshot" enable row level security;
create policy assessment_read_authenticated on public."AssessmentType" for select to authenticated using (public.has_portal_access());
create policy score_read_owner_teacher_admin on public."Score" for select to authenticated using (exists (select 1 from public."Student" s where s.id = student_id and s.user_id = auth.uid()) or public.is_admin() or public.is_approved_teacher());
create policy score_write_form_teacher_scope on public."Score" for all to authenticated using (public.is_approved_teacher() and exists (select 1 from public."Student" s join public."TeachingSchedule" ts on ts.class_id = s.class_id and ts.subject_id = public."Score".subject_id where s.id = public."Score".student_id and ts.teacher_id = auth.uid() and ts.is_form_teacher) and exists (select 1 from public."Term" t where t.id = public."Score".term_id and t.is_active)) with check (public.is_approved_teacher() and recorded_by = auth.uid() and exists (select 1 from public."Student" s join public."TeachingSchedule" ts on ts.class_id = s.class_id and ts.subject_id = public."Score".subject_id where s.id = public."Score".student_id and ts.teacher_id = auth.uid() and ts.is_form_teacher) and exists (select 1 from public."Term" t where t.id = public."Score".term_id and t.is_active));
create policy snapshot_read_owner_staff on public."TermResultSnapshot" for select to authenticated using (exists (select 1 from public."Student" s where s.id = student_id and s.user_id = auth.uid()) or public.is_admin() or public.is_approved_teacher());
grant select on public."AssessmentType", public."Score", public."TermResultSnapshot" to authenticated; grant insert, update, delete on public."Score" to authenticated;

insert into public."AssessmentType" (name, weight_pct, max_score, subject_id)
select assessment.name, assessment.weight, assessment.max_score, subject.id
from public."Subject" subject cross join (values ('Note'::text, 10::numeric, 10::numeric), ('Assignment'::text, 10::numeric, 10::numeric), ('Test'::text, 10::numeric, 10::numeric), ('Exam'::text, 70::numeric, 70::numeric)) assessment(name, weight, max_score)
on conflict (name, subject_id) do nothing;

create or replace function public.validate_score_max()
returns trigger language plpgsql security definer set search_path = public
as $$
declare maximum numeric;
begin
  select max_score into maximum from public."AssessmentType" where id = new.assessment_type_id and subject_id = new.subject_id;
  if maximum is null then raise exception 'assessment type does not belong to this subject'; end if;
  if new.raw_score > maximum then raise exception 'score exceeds the maximum for this assessment'; end if;
  return new;
end;
$$;
create trigger score_maximum_check before insert or update on public."Score" for each row execute function public.validate_score_max();

create or replace function public.calculate_term_results(target_term_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare student_row record; subject_row record; average numeric; position_value integer; cohort integer;
begin
  for subject_row in select id, class_id from public."Subject" loop
    for student_row in select s.id from public."Student" s where s.class_id = subject_row.class_id loop
      select coalesce(sum(sc.raw_score), 0) into average from public."Score" sc join public."AssessmentType" at on at.id = sc.assessment_type_id where sc.student_id = student_row.id and sc.subject_id = subject_row.id and sc.term_id = target_term_id;
      insert into public."TermResultSnapshot" (student_id, subject_id, term_id, weighted_average) values (student_row.id, subject_row.id, target_term_id, round(average, 2)) on conflict (student_id, subject_id, term_id) do update set weighted_average = excluded.weighted_average, computed_at = now();
    end loop;
  end loop;
  with ranked as (select snapshot.id, row_number() over (partition by student.class_id, snapshot.subject_id order by snapshot.weighted_average desc) as rank_value, count(*) over (partition by student.class_id, snapshot.subject_id) as cohort_value from public."TermResultSnapshot" snapshot join public."Student" student on student.id = snapshot.student_id where snapshot.term_id = target_term_id and snapshot.subject_id is not null)
  update public."TermResultSnapshot" snapshot set class_position = ranked.rank_value, cohort_size = ranked.cohort_value, computed_at = now() from ranked where snapshot.id = ranked.id;
end;
$$;
create or replace function public.recalculate_after_score_change()
returns trigger language plpgsql security definer set search_path = public
as $$ begin perform public.calculate_term_results(new.term_id); return new; end; $$;
create trigger score_recalculate after insert or update on public."Score" for each row execute function public.recalculate_after_score_change();
revoke all on function public.calculate_term_results(uuid) from public; grant execute on function public.calculate_term_results(uuid) to authenticated;
