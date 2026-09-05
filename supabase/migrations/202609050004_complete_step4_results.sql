-- Complete Step 4 result snapshots and term-close recalculation.

create or replace function public.calculate_term_results(target_term_id uuid)
returns void language plpgsql security definer set search_path = public
as $$

declare
  student_row record;
  subject_row record;
  average numeric;
begin
  for subject_row in select id, class_id from public."Subject" loop
    for student_row in
      select s.id
      from public."Student" s
      where s.class_id = subject_row.class_id
    loop
      select coalesce(sum((sc.raw_score / nullif(at.max_score, 0)) * at.weight_pct), 0)
        into average
      from public."Score" sc
      join public."AssessmentType" at on at.id = sc.assessment_type_id
      where sc.student_id = student_row.id
        and sc.subject_id = subject_row.id
        and sc.term_id = target_term_id;

      insert into public."TermResultSnapshot"
        (student_id, subject_id, term_id, weighted_average)
      values
        (student_row.id, subject_row.id, target_term_id, round(average, 2))
      on conflict (student_id, subject_id, term_id) do update
        set weighted_average = excluded.weighted_average,
            computed_at = now();
    end loop;
  end loop;

  delete from public."TermResultSnapshot"
  where term_id = target_term_id and subject_id is null;

  insert into public."TermResultSnapshot"
    (student_id, subject_id, term_id, weighted_average)
  select student.id, null, target_term_id, round(avg(snapshot.weighted_average), 2)
  from public."TermResultSnapshot" snapshot
  join public."Student" student on student.id = snapshot.student_id
  where snapshot.term_id = target_term_id
    and snapshot.subject_id is not null
  group by student.id;

  with ranked as (
    select snapshot.id,
      row_number() over (
        partition by student.class_option_id, snapshot.subject_id
        order by snapshot.weighted_average desc, snapshot.student_id
      ) as rank_value,
      count(*) over (
        partition by student.class_option_id, snapshot.subject_id
      ) as cohort_value
    from public."TermResultSnapshot" snapshot
    join public."Student" student on student.id = snapshot.student_id
    where snapshot.term_id = target_term_id
      and student.class_option_id is not null
  )
  update public."TermResultSnapshot" snapshot
  set class_position = ranked.rank_value,
      cohort_size = ranked.cohort_value,
      computed_at = now()
  from ranked
  where snapshot.id = ranked.id;
end;
$$;

create or replace function public.close_term(target_term_id uuid)
returns public."Term" language plpgsql security definer set search_path = public
as $$
declare result public."Term";
begin
  if not public.is_admin() then
    raise exception 'only an admin can close a term';
  end if;
  if not exists (select 1 from public."Term" where id = target_term_id) then
    raise exception 'term not found';
  end if;
  perform public.calculate_term_results(target_term_id);
  update public."Term"
  set is_active = false
  where id = target_term_id
  returning * into result;
  return result;
end;
$$;

revoke all on function public.close_term(uuid) from public;
grant execute on function public.close_term(uuid) to authenticated;

