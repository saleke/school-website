-- Step 3 repair: public applications may report any allowed source, while the
-- stage remains fixed to applied on creation.
drop policy if exists admission_public_insert on public."AdmissionApplication";
create policy admission_public_insert on public."AdmissionApplication"
  for insert to anon, authenticated
  with check (stage = 'applied');
