-- Step 2 reference data: the school's fixed class sections.
-- These are intentionally small, reusable reference rows; later steps add
-- subjects and curriculum against them.

insert into public."Class" (name, grade_level, max_capacity)
select format('%s%s', grade_level, section), grade_level, null
from unnest(array['JSS1', 'JSS2', 'JSS3', 'SSS1', 'SSS2', 'SSS3']) as grades(grade_level)
cross join unnest(array['A', 'B', 'C', 'D']) as sections(section)
on conflict (name) do nothing;
