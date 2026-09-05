-- Keep provisional result snapshots current while a term is active.
create or replace function public.recalculate_after_score_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare 
  affected_term_id uuid;
begin
  if tg_op = 'DELETE' then
    affected_term_id := old.term_id;
  else
    affected_term_id := new.term_id;
  end if;
  perform public.calculate_term_results(affected_term_id);
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists score_recalculate on public."Score";
create trigger score_recalculate
after insert or update or delete on public."Score"
for each row execute function public.recalculate_after_score_change();

-- Populate snapshots for scores that existed before the live recalculation path.
do $$
declare term_row record;
begin
  for term_row in select id from public."Term" loop
    perform public.calculate_term_results(term_row.id);
  end loop;
end;
$$;

revoke all on function public.recalculate_after_score_change() from public;
