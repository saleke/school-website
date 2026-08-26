-- Keep the active-term switch explicit and avoid broad UPDATE warnings.
create or replace function public.activate_term(target_term_id uuid)
returns public."Term" language plpgsql security definer set search_path = public
as $$
declare result public."Term";
begin
  if not public.is_admin() then
    raise exception 'only an admin can activate a term';
  end if;
  if not exists (select 1 from public."Term" where id = target_term_id) then
    raise exception 'term not found';
  end if;
  update public."Term" set is_active = false where is_active = true;
  update public."Term" set is_active = true where id = target_term_id;
  select * into result from public."Term" where id = target_term_id;
  return result;
end;
$$;
