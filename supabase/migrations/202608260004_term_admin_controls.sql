create or replace function public.activate_term(target_term_id uuid)
returns public."Term" language plpgsql security definer set search_path = public
as $$ declare result public."Term"; begin
 if not public.is_admin() then raise exception 'only an admin can activate a term'; end if;
 update public."Term" set is_active=false where is_active=true;
 update public."Term" set is_active=true where id=target_term_id returning * into result;
 if result.id is null then raise exception 'term not found'; end if; return result;
end; $$;
revoke all on function public.activate_term(uuid) from public;
grant execute on function public.activate_term(uuid) to authenticated;
