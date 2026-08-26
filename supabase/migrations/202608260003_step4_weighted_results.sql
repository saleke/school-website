-- Correct weighted averages: normalize each raw score by its maximum, then apply weight.
create or replace function public.calculate_term_results(target_term_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare student_row record; subject_row record; average numeric;
begin
  for subject_row in select id, class_id from public."Subject" loop
    for student_row in select s.id from public."Student" s where s.class_id = subject_row.class_id loop
      select coalesce(sum((sc.raw_score / nullif(at.max_score, 0)) * at.weight_pct), 0)
        into average
      from public."Score" sc
      join public."AssessmentType" at on at.id = sc.assessment_type_id
      where sc.student_id = student_row.id and sc.subject_id = subject_row.id and sc.term_id = target_term_id;
      insert into public."TermResultSnapshot" (student_id, subject_id, term_id, weighted_average)
      values (student_row.id, subject_row.id, target_term_id, round(average, 2))
      on conflict (student_id, subject_id, term_id) do update
        set weighted_average = excluded.weighted_average, computed_at = now();
    end loop;
  end loop;
  with ranked as (
    select snapshot.id,
      row_number() over (partition by student.class_option_id, snapshot.subject_id order by snapshot.weighted_average desc) as rank_value,
      count(*) over (partition by student.class_option_id, snapshot.subject_id) as cohort_value
    from public."TermResultSnapshot" snapshot
    join public."Student" student on student.id = snapshot.student_id
    where snapshot.term_id = target_term_id and snapshot.subject_id is not null and student.class_option_id is not null
  )
  update public."TermResultSnapshot" snapshot
  set class_position = ranked.rank_value, cohort_size = ranked.cohort_value, computed_at = now()
  from ranked where snapshot.id = ranked.id;
end;
$$;
