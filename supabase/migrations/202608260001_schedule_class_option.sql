-- Teaching slots may target a specific active section within a class.
alter table public."TeachingSchedule"
  add column if not exists class_option_id uuid references public."ClassOption"(id) on delete cascade;

create index if not exists schedule_class_option_idx
  on public."TeachingSchedule" (class_option_id);

create or replace function public.validate_schedule_option()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.class_option_id is not null and not exists (
    select 1 from public."ClassOption" option_row
    where option_row.id = new.class_option_id
      and option_row.class_id = new.class_id
      and option_row.is_active
  ) then
    raise exception 'schedule section must belong to the scheduled class and be active';
  end if;
  return new;
end;
$$;

drop trigger if exists schedule_option_integrity on public."TeachingSchedule";
create trigger schedule_option_integrity
before insert or update on public."TeachingSchedule"
for each row execute function public.validate_schedule_option();

grant update on public."TeachingSchedule" to authenticated;
