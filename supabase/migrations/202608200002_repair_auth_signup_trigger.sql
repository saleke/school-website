-- Repair Step 2 signup for databases that already ran 202608200001.
-- Keep role validation on updates, but avoid a second trigger during the
-- Auth-created profile insert.

drop trigger if exists user_role_fields on public."User";
create trigger user_role_fields
  before update on public."User"
  for each row execute function public.validate_user_role_fields();

drop trigger if exists on_auth_user_created on auth.users;

create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_role public.user_role;
begin
  safe_role := case
    when new.raw_user_meta_data ->> 'role' = 'teacher' then 'teacher'::public.user_role
    else 'student'::public.user_role
  end;

  insert into public."User" (id, name, email, role, teacher_approval_status)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
    new.email,
    safe_role,
    case
      when safe_role = 'teacher'::public.user_role then 'pending'::public.teacher_approval_status
      else null
    end
  );

  if safe_role = 'student'::public.user_role then
    insert into public."Student" (user_id) values (new.id);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_auth_user_created();

