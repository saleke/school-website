-- Step 2 class-scoped reference subjects.
-- JSS receives the full list except the seven senior-only subjects below.
-- SSS receives the complete list.

insert into public."Subject" (name, class_id)
select subject_name, c.id
from public."Class" c
cross join unnest(array[
  'English Language', 'Mathematics', 'Agricultural Science',
  'Physical Education', 'Health Education', 'Foods and Nutrition',
  'Technical Drawing', 'Nigerian History',
  'Christian Religious Studies (CRS) / Islamic Studies (IS)',
  'French', 'Visual Arts', 'Trade / Entrepreneurship'
]) as subjects(subject_name)
where c.grade_level like 'JSS%'
on conflict (name, class_id) do nothing;

insert into public."Subject" (name, class_id)
select subject_name, c.id
from public."Class" c
cross join unnest(array[
  'Biology', 'Chemistry', 'Physics', 'Further Mathematics', 'Geography',
  'Literature in English', 'Government', 'English Language', 'Mathematics',
  'Agricultural Science', 'Physical Education', 'Health Education',
  'Foods and Nutrition', 'Technical Drawing', 'Nigerian History',
  'Christian Religious Studies (CRS) / Islamic Studies (IS)', 'French',
  'Visual Arts', 'Trade / Entrepreneurship'
]) as subjects(subject_name)
where c.grade_level like 'SSS%'
on conflict (name, class_id) do nothing;
