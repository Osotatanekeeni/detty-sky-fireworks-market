-- Concurrency check for place_order(): many buyers race for the last few units.
-- Run against a DEV/STAGING database only (it creates orders):
--
--   psql "$DB_URL" -f scripts/loadtest/oversell.sql          -- sets up, prints the product id
--   echo "select race_buy('<product id>');" > /tmp/race.sql
--   pgbench -n -c 40 -j 8 -t 3 -f /tmp/race.sql "$DB_URL"
--   psql "$DB_URL" -c "select ok, count(*) from race_log group by ok"
--
-- Expected: exactly as many winners (ok = true) as the stock you set, reserved = stock, and no
-- pgbench failures. Clean up with: drop function race_buy(uuid); drop table race_log;
-- and cancel the test orders (status pending_payment, email race@test.ng).
create table if not exists race_log (ok boolean);
truncate race_log;

create or replace function race_buy(pid uuid) returns void language plpgsql as $$
begin
  perform place_order(
    jsonb_build_object('email', 'race@test.ng', 'customer_name', 'Race', 'phone', '08030000123',
      'state', 'Rivers', 'city', 'Port Harcourt', 'street', '1 Race Rd',
      'subtotal_kobo', 1800000, 'delivery_fee_kobo', 250000, 'total_kobo', 2050000, 'eta', '2026-12-01'),
    jsonb_build_array(jsonb_build_object('kind', 'product', 'product_id', pid, 'name', 'Race item',
      'qty', 1, 'unit_price_kobo', 1800000, 'line_total_kobo', 1800000)),
    jsonb_build_array(jsonb_build_object('product_id', pid, 'qty', 1)));
  insert into race_log values (true);
exception when others then
  if sqlerrm like 'OUT_OF_STOCK%' then insert into race_log values (false); else raise; end if;
end $$;

update public.products set stock = 5, reserved = 0 where slug = 'silver-waterfall-fountain' returning id;
