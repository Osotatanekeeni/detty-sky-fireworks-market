-- Phase 2: checkout + Paystack.

-- Release unpaid holds every 5 minutes (CLAUDE.md money rule 5). pg_cron ships with Supabase;
-- enable it under Database → Extensions if this errors. Skipped where pg_cron isn't installed
-- (plain local Postgres).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('release-expired-holds', '*/5 * * * *', 'select public.release_expired_holds()');
  else
    raise notice 'pg_cron not available — schedule release_expired_holds() yourself';
  end if;
end $$;

-- Order lookups by payment reference (callback page) and by number (tracking).
create index if not exists orders_number_idx on public.orders (number);

-- Admin moves along the delivery timeline only — never into/out of pending_payment (that's
-- confirm_payment's job, which also moves stock) and never backwards.
create or replace function public.set_order_status(p_order uuid, p_status public.order_status, p_note text default '')
returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  steps public.order_status[] := array['processing', 'dispatched', 'out_for_delivery', 'delivered']::public.order_status[];
begin
  if not public.is_admin() and current_user <> 'service_role' then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into o from orders where id = p_order for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if o.status = p_status then return o; end if;
  if array_position(steps, o.status) is null or array_position(steps, p_status) is null
     or array_position(steps, p_status) < array_position(steps, o.status) then
    raise exception 'BAD_TRANSITION:% -> %', o.status, p_status using errcode = 'P0001';
  end if;
  update orders set status = p_status where id = p_order returning * into o;
  insert into order_status_events (order_id, status, note, actor) values (o.id, p_status, p_note, auth.uid());
  return o;
end $$;
