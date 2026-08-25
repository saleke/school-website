-- Repair databases where senior-only subjects were previously attached to JSS
-- classes, then ensure the correct shared and senior subject sets exist.

delete from public."Subject" as subject
using public."Class" as class
where subject.class_id = class.id
  and class.grade_level like 'JSS%'
  and subject.name in (
    'Biology', 'Chemistry', 'Physics', 'Further Mathematics', 'Geography',
    'Literature in English', 'Government'
  );

with shared_subjects(name) as (
  values
    ('English Language'), ('Mathematics'), ('Agricultural Science'),
    ('Physical Education'), ('Health Education'), ('Foods and Nutrition'),
    ('Technical Drawing'), ('Nigerian History'),
    ('Christian Religious Studies (CRS) / Islamic Studies (IS)'),
    ('French'), ('Visual Arts'), ('Trade / Entrepreneurship')
)
insert into public."Subject" (name, class_id)
select shared_subjects.name, class.id
from public."Class" as class
cross join shared_subjects
on conflict (name, class_id) do nothing;

with senior_subjects(name) as (
  values
    ('Biology'), ('Chemistry'), ('Physics'), ('Further Mathematics'),
    ('Geography'), ('Literature in English'), ('Government')
)
insert into public."Subject" (name, class_id)
select senior_subjects.name, class.id
from public."Class" as class
cross join senior_subjects
where class.grade_level like 'SSS%'
on conflict (name, class_id) do nothing;

do $$
begin
  if exists (
    select 1 from public."Subject" subject
    join public."Class" class on class.id = subject.class_id
    where class.grade_level like 'JSS%'
      and subject.name in (
        'Biology', 'Chemistry', 'Physics', 'Further Mathematics', 'Geography',
        'Literature in English', 'Government'
      )
  ) then
    raise exception 'Step 2 subject scope repair failed: JSS class has a senior-only subject';
  end if;
end;
$$;
