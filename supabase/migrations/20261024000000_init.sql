-- Detty Sky — initial schema (Phase 1 of CLAUDE.md).
--
-- Money is stored in KOBO (bigint). ₦85,000 = 8_500_000. Paystack also works in kobo,
-- so amounts go to/from Paystack unchanged. Convert to naira only for display.
--
-- Writes that move money or stock (placing an order, confirming payment) happen ONLY
-- through the security-definer functions at the bottom, called by server functions with
-- the service-role key. Browsers can never insert orders or payments directly.

-- ── Types ────────────────────────────────────────────────────
create type public.ss_state as enum ('Akwa Ibom', 'Bayelsa', 'Cross River', 'Delta', 'Edo', 'Rivers');
create type public.user_role as enum ('customer', 'admin');
create type public.noise_level as enum ('Quiet', 'Medium', 'Loud');
create type public.order_status as enum ('pending_payment', 'processing', 'dispatched', 'out_for_delivery', 'delivered', 'cancelled');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
create type public.quote_status as enum ('new', 'quoted', 'converted', 'closed');
create type public.review_status as enum ('pending', 'approved', 'hidden');
create type public.line_kind as enum ('product', 'bundle', 'custom');

-- ── Helpers ──────────────────────────────────────────────────
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ── People ───────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  role public.user_role not null default 'customer',
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

-- New auth user → profile row. Role always starts as customer; promote yourself once in SQL.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), coalesce(new.raw_user_meta_data ->> 'phone', ''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null default 'Home',
  state public.ss_state not null,
  city text not null,
  street text not null,
  phone text not null,
  created_at timestamptz not null default now()
);
create index on public.addresses (user_id);

-- ── Catalogue ────────────────────────────────────────────────
create table public.categories (
  slug text primary key,
  name text not null,
  blurb text not null default '',
  sort int not null default 0
);

create table public.occasions (
  slug text primary key,
  name text not null,
  blurb text not null default '',
  emoji text not null default '',
  sort int not null default 0
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  category_slug text not null references public.categories (slug),
  description text not null default '',
  price_kobo bigint not null check (price_kobo > 0),
  compare_at_kobo bigint check (compare_at_kobo is null or compare_at_kobo > price_kobo),
  duration_sec int not null default 0 check (duration_sec >= 0),
  shots int not null default 0 check (shots >= 0),
  height_m numeric(5, 1) not null default 0 check (height_m >= 0),
  noise public.noise_level not null default 'Medium',
  colours text[] not null default '{}',
  stock int not null default 0 check (stock >= 0),
  -- Units held by unpaid orders. Sellable = stock - reserved.
  reserved int not null default 0 check (reserved >= 0 and reserved <= stock),
  low_stock_threshold int not null default 10 check (low_stock_threshold >= 0),
  preorder_arrives date,
  best_seller boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.products (category_slug) where is_active;
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();

create table public.product_occasions (
  product_id uuid not null references public.products (id) on delete cascade,
  occasion_slug text not null references public.occasions (slug) on delete cascade,
  primary key (product_id, occasion_slug)
);

-- Images and videos live in Cloudflare R2; we store the public URL.
create table public.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  kind text not null check (kind in ('image', 'video', 'poster')),
  url text not null,
  sort int not null default 0
);
create index on public.product_media (product_id, sort);

create table public.price_tiers (
  product_id uuid not null references public.products (id) on delete cascade,
  min_qty int not null check (min_qty > 1),
  discount_pct int not null check (discount_pct between 1 and 90),
  primary key (product_id, min_qty)
);

create table public.bundles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  tagline text not null default '',
  image_url text not null default '',
  price_kobo bigint not null check (price_kobo > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.bundle_items (
  bundle_id uuid not null references public.bundles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  qty int not null check (qty > 0),
  primary key (bundle_id, product_id)
);

-- ── Delivery & compliance ────────────────────────────────────
create table public.delivery_cities (
  id uuid primary key default gen_random_uuid(),
  state public.ss_state not null,
  name text not null,
  fee_kobo bigint not null check (fee_kobo >= 0),
  days int not null check (days between 1 and 30),
  is_active boolean not null default true,
  unique (state, name)
);

-- The kill switch: a row here = that category can't be sold for delivery to that state.
create table public.category_state_blocks (
  category_slug text not null references public.categories (slug) on delete cascade,
  state public.ss_state not null,
  reason text not null default '',
  created_at timestamptz not null default now(),
  primary key (category_slug, state)
);

-- ── Wishlist ─────────────────────────────────────────────────
create table public.wishlist_items (
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- ── Marketing ────────────────────────────────────────────────
create table public.discount_codes (
  code text primary key check (code ~ '^[A-Z0-9]{3,20}$'),
  pct int not null check (pct between 1 and 50),
  active boolean not null default true,
  uses int not null default 0,
  max_uses int,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text not null default '',
  cta text not null default 'Shop now',
  href text not null check (href like '/%'),
  tone text not null default 'party' check (tone in ('gold', 'party', 'royal')),
  active boolean not null default true,
  sort int not null default 0
);

-- Single-row settings table.
create table public.campaign_settings (
  id int primary key default 1 check (id = 1),
  announcement text not null default '',
  preorders_open boolean not null default true,
  countdown_label text not null default 'Countdown to New Year'
);
insert into public.campaign_settings (id) values (1);

-- ── Orders & payments ────────────────────────────────────────
create sequence public.order_number_seq start 10300;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('DS-' || nextval('public.order_number_seq')),
  user_id uuid references public.profiles (id) on delete set null,  -- null = guest
  email text not null,
  customer_name text not null,
  phone text not null,
  state public.ss_state not null,
  city text not null,
  street text not null,
  status public.order_status not null default 'pending_payment',
  subtotal_kobo bigint not null check (subtotal_kobo >= 0),
  bulk_discount_kobo bigint not null default 0 check (bulk_discount_kobo >= 0),
  code text references public.discount_codes (code) on delete set null,
  code_discount_kobo bigint not null default 0 check (code_discount_kobo >= 0),
  delivery_fee_kobo bigint not null default 0 check (delivery_fee_kobo >= 0),
  total_kobo bigint not null check (total_kobo > 0),
  eta date,
  reserved_until timestamptz,          -- unpaid orders release stock after this
  quote_id uuid,                       -- set when created from a bulk quote (FK added below)
  note text not null default '',
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  check (total_kobo = subtotal_kobo - bulk_discount_kobo - code_discount_kobo + delivery_fee_kobo)
);
create index on public.orders (user_id, created_at desc);
create index on public.orders (lower(email));
create index on public.orders (status, created_at desc);
create index on public.orders (reserved_until) where status = 'pending_payment';

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  kind public.line_kind not null default 'product',
  product_id uuid references public.products (id) on delete set null,
  bundle_id uuid references public.bundles (id) on delete set null,
  name text not null,                       -- snapshot at purchase time
  qty int not null check (qty > 0),
  unit_price_kobo bigint not null check (unit_price_kobo >= 0),
  line_total_kobo bigint not null check (line_total_kobo >= 0),
  preorder_arrives date
);
create index on public.order_items (order_id);

-- Units each order holds, per product (bundles are expanded). Released on payment or expiry.
create table public.stock_reservations (
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  qty int not null check (qty > 0),
  primary key (order_id, product_id)
);

create table public.order_status_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  status public.order_status not null,
  note text not null default '',
  actor uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.order_status_events (order_id, created_at);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  provider text not null default 'paystack',
  reference text not null unique,
  channel text,                       -- card | bank_transfer | ussd | ...
  status public.payment_status not null default 'pending',
  amount_kobo bigint not null,
  raw jsonb,                          -- last Paystack payload, for disputes
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index on public.payments (order_id);

-- ── Reviews ──────────────────────────────────────────────────
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  order_item_id uuid not null unique references public.order_items (id) on delete cascade,  -- = verified purchase
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  title text not null check (length(title) between 3 and 120),
  body text not null check (length(body) between 10 and 4000),
  author_display text not null,
  city text not null default '',
  status public.review_status not null default 'pending',
  created_at timestamptz not null default now()
);
create index on public.reviews (product_id) where status = 'approved';

create table public.review_media (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  kind text not null check (kind in ('photo', 'video')),
  url text not null
);

-- ── Bulk quotes ──────────────────────────────────────────────
create table public.bulk_quotes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  org_type text not null,
  event_date date not null,
  state public.ss_state not null,
  city text not null,
  request text not null,
  quantity text not null,
  phone text not null,
  email text,
  notes text not null default '',
  status public.quote_status not null default 'new',
  response text,
  quoted_kobo bigint check (quoted_kobo is null or quoted_kobo > 0),
  order_id uuid references public.orders (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.orders add constraint orders_quote_fk foreign key (quote_id) references public.bulk_quotes (id) on delete set null;

-- ── Row Level Security ───────────────────────────────────────
-- Default: deny. Each table opts in below. The service role (server functions) bypasses RLS.
alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.categories enable row level security;
alter table public.occasions enable row level security;
alter table public.products enable row level security;
alter table public.product_occasions enable row level security;
alter table public.product_media enable row level security;
alter table public.price_tiers enable row level security;
alter table public.bundles enable row level security;
alter table public.bundle_items enable row level security;
alter table public.delivery_cities enable row level security;
alter table public.category_state_blocks enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.discount_codes enable row level security;
alter table public.banners enable row level security;
alter table public.campaign_settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.stock_reservations enable row level security;
alter table public.order_status_events enable row level security;
alter table public.payments enable row level security;
alter table public.reviews enable row level security;
alter table public.review_media enable row level security;
alter table public.bulk_quotes enable row level security;

-- Public catalogue: anyone can read; only admins write.
create policy "read categories" on public.categories for select using (true);
create policy "read occasions" on public.occasions for select using (true);
create policy "read active products" on public.products for select using (is_active or public.is_admin());
create policy "read product occasions" on public.product_occasions for select using (true);
create policy "read product media" on public.product_media for select using (true);
create policy "read price tiers" on public.price_tiers for select using (true);
create policy "read active bundles" on public.bundles for select using (is_active or public.is_admin());
create policy "read bundle items" on public.bundle_items for select using (true);
create policy "read delivery cities" on public.delivery_cities for select using (is_active or public.is_admin());
create policy "read state blocks" on public.category_state_blocks for select using (true);
create policy "read active banners" on public.banners for select using (active or public.is_admin());
create policy "read campaign" on public.campaign_settings for select using (true);
create policy "read approved reviews" on public.reviews for select using (status = 'approved' or user_id = auth.uid() or public.is_admin());
create policy "read review media" on public.review_media for select using (
  exists (select 1 from public.reviews r where r.id = review_id and (r.status = 'approved' or r.user_id = auth.uid() or public.is_admin()))
);

create policy "admin writes categories" on public.categories for all using (public.is_admin()) with check (public.is_admin());
create policy "admin writes occasions" on public.occasions for all using (public.is_admin()) with check (public.is_admin());
create policy "admin writes products" on public.products for all using (public.is_admin()) with check (public.is_admin());
create policy "admin writes product occasions" on public.product_occasions for all using (public.is_admin()) with check (public.is_admin());
create policy "admin writes product media" on public.product_media for all using (public.is_admin()) with check (public.is_admin());
create policy "admin writes price tiers" on public.price_tiers for all using (public.is_admin()) with check (public.is_admin());
create policy "admin writes bundles" on public.bundles for all using (public.is_admin()) with check (public.is_admin());
create policy "admin writes bundle items" on public.bundle_items for all using (public.is_admin()) with check (public.is_admin());
create policy "admin writes delivery cities" on public.delivery_cities for all using (public.is_admin()) with check (public.is_admin());
create policy "admin writes state blocks" on public.category_state_blocks for all using (public.is_admin()) with check (public.is_admin());
create policy "admin writes banners" on public.banners for all using (public.is_admin()) with check (public.is_admin());
create policy "admin writes campaign" on public.campaign_settings for all using (public.is_admin()) with check (public.is_admin());
create policy "admin manages codes" on public.discount_codes for all using (public.is_admin()) with check (public.is_admin());
create policy "admin moderates reviews" on public.reviews for update using (public.is_admin()) with check (public.is_admin());

-- Customers: their own profile, addresses, wishlist, orders.
create policy "own profile" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
-- Stop customers promoting themselves: they may only change name and phone.
revoke update on public.profiles from anon, authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

create policy "own addresses" on public.addresses for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own wishlist" on public.wishlist_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own or admin orders" on public.orders for select using (user_id = auth.uid() or public.is_admin());
create policy "own or admin order items" on public.order_items for select using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin()))
);
create policy "own or admin order events" on public.order_status_events for select using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin()))
);
create policy "admin reads payments" on public.payments for select using (public.is_admin());
create policy "admin reads reservations" on public.stock_reservations for select using (public.is_admin());
-- Order inserts/updates: none for clients. Server functions use place_order / confirm_payment /
-- set_order_status below (service role or admin).

-- Reviews: only for your own DELIVERED order item, always enters as pending.
create policy "review own delivered purchase" on public.reviews for insert with check (
  user_id = auth.uid() and status = 'pending' and exists (
    select 1 from public.order_items oi join public.orders o on o.id = oi.order_id
    where oi.id = order_item_id and oi.product_id = reviews.product_id and o.user_id = auth.uid() and o.status = 'delivered'
  )
);
create policy "attach media to own review" on public.review_media for insert with check (
  exists (select 1 from public.reviews r where r.id = review_id and r.user_id = auth.uid())
);

-- Bulk quotes: anyone can submit (add Cloudflare Turnstile on the form); only admins read/update.
create policy "submit quote" on public.bulk_quotes for insert with check (status = 'new' and response is null and quoted_kobo is null and order_id is null);
create policy "admin manages quotes" on public.bulk_quotes for select using (public.is_admin());
create policy "admin updates quotes" on public.bulk_quotes for update using (public.is_admin()) with check (public.is_admin());

-- ── Stock & payment functions ────────────────────────────────
-- place_order: called by the checkout server function AFTER it has priced the cart with
-- lib/checkout.ts → priceCart() against fresh DB data. This function re-checks stock
-- atomically (row locks) so two buyers can't take the last unit.
--
-- p_order:  { user_id?, email, customer_name, phone, state, city, street, subtotal_kobo,
--             bulk_discount_kobo, code?, code_discount_kobo, delivery_fee_kobo, total_kobo, eta }
-- p_items:  [{ kind, product_id?, bundle_id?, name, qty, unit_price_kobo, line_total_kobo, preorder_arrives? }]
-- p_stock:  [{ product_id, qty }]  — in-stock units to hold (pre-order units excluded)
create or replace function public.place_order(p_order jsonb, p_items jsonb, p_stock jsonb, p_hold interval default interval '30 minutes')
returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  s record;
begin
  -- Lock the affected product rows in a fixed order to avoid deadlocks, then check stock.
  for s in
    select (x ->> 'product_id')::uuid as product_id, sum((x ->> 'qty')::int) as qty
    from jsonb_array_elements(p_stock) x group by 1 order by 1
  loop
    perform 1 from products where id = s.product_id for update;
    if not exists (select 1 from products where id = s.product_id and is_active and stock - reserved >= s.qty) then
      raise exception 'OUT_OF_STOCK:%', s.product_id using errcode = 'P0001';
    end if;
  end loop;

  insert into orders (user_id, email, customer_name, phone, state, city, street, subtotal_kobo, bulk_discount_kobo, code,
                      code_discount_kobo, delivery_fee_kobo, total_kobo, eta, reserved_until)
  values (nullif(p_order ->> 'user_id', '')::uuid, p_order ->> 'email', p_order ->> 'customer_name', p_order ->> 'phone',
          (p_order ->> 'state')::ss_state, p_order ->> 'city', p_order ->> 'street',
          (p_order ->> 'subtotal_kobo')::bigint, coalesce((p_order ->> 'bulk_discount_kobo')::bigint, 0), nullif(p_order ->> 'code', ''),
          coalesce((p_order ->> 'code_discount_kobo')::bigint, 0), coalesce((p_order ->> 'delivery_fee_kobo')::bigint, 0),
          (p_order ->> 'total_kobo')::bigint, (p_order ->> 'eta')::date, now() + p_hold)
  returning * into o;

  insert into order_items (order_id, kind, product_id, bundle_id, name, qty, unit_price_kobo, line_total_kobo, preorder_arrives)
  select o.id, coalesce((x ->> 'kind')::line_kind, 'product'), (x ->> 'product_id')::uuid, (x ->> 'bundle_id')::uuid, x ->> 'name',
         (x ->> 'qty')::int, (x ->> 'unit_price_kobo')::bigint, (x ->> 'line_total_kobo')::bigint, (x ->> 'preorder_arrives')::date
  from jsonb_array_elements(p_items) x;

  insert into stock_reservations (order_id, product_id, qty)
  select o.id, (x ->> 'product_id')::uuid, sum((x ->> 'qty')::int) from jsonb_array_elements(p_stock) x group by 2;

  update products p set reserved = p.reserved + r.qty from stock_reservations r where r.order_id = o.id and r.product_id = p.id;
  insert into order_status_events (order_id, status, note) values (o.id, 'pending_payment', 'Order created');
  return o;
end $$;

-- confirm_payment: called by the Paystack webhook (after verifying x-paystack-signature) and
-- by the callback page (after GET /transaction/verify). Idempotent — safe to call twice.
create or replace function public.confirm_payment(p_reference text, p_amount_kobo bigint, p_channel text, p_raw jsonb)
returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  pay public.payments;
  o public.orders;
begin
  select * into pay from payments where reference = p_reference for update;
  if not found then raise exception 'UNKNOWN_REFERENCE:%', p_reference using errcode = 'P0001'; end if;
  select * into o from orders where id = pay.order_id for update;
  if pay.status = 'paid' then return o; end if;                      -- already handled
  if p_amount_kobo <> o.total_kobo then
    update payments set status = 'failed', raw = p_raw where id = pay.id;
    raise exception 'AMOUNT_MISMATCH:% expected % got %', o.number, o.total_kobo, p_amount_kobo using errcode = 'P0001';
  end if;

  update payments set status = 'paid', channel = p_channel, raw = p_raw, paid_at = now() where id = pay.id;

  if o.status = 'pending_payment' then
    -- Normal path: convert the hold into a sale.
    update products p set stock = p.stock - r.qty, reserved = p.reserved - r.qty
      from stock_reservations r where r.order_id = o.id and r.product_id = p.id;
  else
    -- Paid after the hold expired (status 'cancelled'): take stock now if we still can.
    -- If stock has run out the update fails the check constraint → handle as a refund case.
    update products p set stock = p.stock - r.qty
      from stock_reservations r where r.order_id = o.id and r.product_id = p.id;
  end if;
  delete from stock_reservations where order_id = o.id;

  update orders set status = 'processing', paid_at = now(), reserved_until = null where id = o.id returning * into o;
  if o.code is not null then update discount_codes set uses = uses + 1 where code = o.code; end if;
  insert into order_status_events (order_id, status, note) values (o.id, 'processing', 'Payment confirmed via ' || coalesce(p_channel, 'paystack'));
  return o;
end $$;

-- Releases holds on unpaid orders. Schedule every 5 minutes with pg_cron:
--   select cron.schedule('release-expired-holds', '*/5 * * * *', $$select public.release_expired_holds()$$);
-- Reservations are KEPT on cancelled orders so a late payment can still claim stock in confirm_payment.
create or replace function public.release_expired_holds() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with expired as (
    update orders set status = 'cancelled'
    where status = 'pending_payment' and reserved_until < now()
    returning id
  ), released as (
    update products p set reserved = p.reserved - r.qty
    from (select product_id, sum(qty) as qty from stock_reservations where order_id in (select id from expired) group by 1) r
    where p.id = r.product_id
    returning 1
  ), ev as (
    insert into order_status_events (order_id, status, note) select id, 'cancelled', 'Payment window expired' from expired returning 1
  )
  select count(*) into n from expired;
  return n;
end $$;

-- Admin moves an order along the delivery timeline. Server function sends the email afterwards.
create or replace function public.set_order_status(p_order uuid, p_status public.order_status, p_note text default '')
returns public.orders
language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  if not public.is_admin() and current_user <> 'service_role' then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  update orders set status = p_status where id = p_order and status <> p_status returning * into o;
  if found then insert into order_status_events (order_id, status, note, actor) values (o.id, p_status, p_note, auth.uid()); end if;
  return o;
end $$;

-- Lock the money functions down: only the service role (server functions) may call them.
revoke execute on function public.place_order(jsonb, jsonb, jsonb, interval) from public, anon, authenticated;
revoke execute on function public.confirm_payment(text, bigint, text, jsonb) from public, anon, authenticated;
revoke execute on function public.release_expired_holds() from public, anon, authenticated;
revoke execute on function public.set_order_status(uuid, public.order_status, text) from public, anon;
grant execute on function public.place_order(jsonb, jsonb, jsonb, interval) to service_role;
grant execute on function public.confirm_payment(text, bigint, text, jsonb) to service_role;
grant execute on function public.release_expired_holds() to service_role;
grant execute on function public.set_order_status(uuid, public.order_status, text) to authenticated, service_role;
