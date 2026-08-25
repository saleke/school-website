-- Step 3 public admissions application.
create type public.admission_source as enum ('website', 'referral', 'walk-in', 'other');
create type public.admission_stage as enum ('applied', 'interviewed', 'accepted', 'enrolled', 'rejected');

create table public."AdmissionApplication" (
  id uuid primary key default gen_random_uuid(),
  applicant_name text not null check (length(trim(applicant_name)) between 2 and 160),
  source public.admission_source not null default 'website',
  stage public.admission_stage not null default 'applied',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public."AdmissionApplication" enable row level security;
create policy admission_public_insert on public."AdmissionApplication"
  for insert to anon, authenticated with check (stage = 'applied' and source = 'website');
create policy admission_admin_read on public."AdmissionApplication"
  for select to authenticated using (public.is_admin());
create policy admission_admin_update on public."AdmissionApplication"
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public."AdmissionApplication" from anon, authenticated;
grant insert on public."AdmissionApplication" to anon, authenticated;
grant select, update on public."AdmissionApplication" to authenticated;
