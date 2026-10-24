# Detty Sky

Online fireworks store selling its own stock to customers in Nigeria's six South-South states
(Akwa Ibom, Bayelsa, Cross River, Delta, Edo, Rivers). Based in Port Harcourt. "Detty Sky" is a
working name. Buyers are individuals (Christmas, New Year, weddings, birthdays) and bulk buyers
(churches, event planners, hotels, clubs). Peak season is December.

The UI was generated in Lovable and is synced to this repo. The owner is a frontend engineer and
is the only admin for now.

> Also read `AGENTS.md`: commits to `main` sync back to Lovable. **Never force-push or rewrite
> pushed history.** Do big work on a branch and keep `main` working.

## Product decisions (settled — don't re-litigate without asking)

- Own store, own stock. Not a marketplace.
- Delivery to all six South-South states only, fee + ETA per city (`delivery_cities`).
- **Prepaid only via Paystack** (card, bank transfer, USSD). **No pay on delivery.**
- Guest checkout allowed; customers can create an account after paying. Guest orders attach to an
  account by email.
- Bulk buyers: automatic tiered discounts (default 10+ = 5%, 25+ = 10%) plus a **quote request
  form**. No separate business accounts in v1.
- No pro display / show-booking service.
- Reviews: verified purchases only (tied to a delivered order item), optional photo/video, admin
  approves before publishing.
- Compliance: 18+ age gate; per-state **category kill switch** (`category_state_blocks`) for when
  police/state government restrict a product type (e.g. bangers/rockets in Rivers).
- Notifications: **email only** for now (Resend). No SMS/WhatsApp messages yet; the WhatsApp
  button is just a click-to-chat link.
- Admin: single owner account. No staff roles yet.

## Stack

| Layer | Choice |
|---|---|
| App | TanStack Start (React 19, SSR, file routing), Vite 8, TypeScript (strict, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`) |
| UI | Tailwind v4, shadcn/ui (Radix), lucide-react, sonner toasts, recharts |
| Backend | TanStack Start **server functions** (`createServerFn`) — no separate API server |
| Database/Auth | **Supabase** (Postgres + Auth + RLS) |
| Media | **Cloudflare R2** for product videos/images and review uploads (zero egress fees — Supabase Storage egress would blow the free tier) |
| Payments | **Paystack** (1.5% + ₦100, capped ₦2,000 per local transaction). Kora is the fallback if Paystack onboarding rejects the fireworks category |
| Email | Resend |
| Hosting | Cloudflare Workers via Nitro (already configured by `@lovable.dev/vite-tanstack-config`) |

Budget at launch: Cloudflare Workers Paid ($5/mo — the free plan's 10 ms CPU limit is too tight
for SSR) + Supabase Pro ($25/mo — free projects pause after a week idle). Develop on free tiers.

## Commands

```sh
bun install        # no global bun? `npx -y bun@1 install` works too (keeps bun.lock)
cp .env.example .env.local   # then fill in Supabase keys — see supabase/README.md
bun run dev        # if it fails with EAFNOSUPPORT ::  →  npx vite dev --host 127.0.0.1
bun run build      # also regenerates src/routeTree.gen.ts — run after adding routes
bun run test       # vitest
npx tsc --noEmit   # typecheck (vite build does NOT typecheck). Keep this at 0 errors.
bun run lint       # NOTE: Lovable's original files fail prettier; `bun run format` fixes all
```

Never edit `src/routeTree.gen.ts` by hand. Don't add plugins to `vite.config.ts` that
`@lovable.dev/vite-tanstack-config` already includes (see the comment in that file).

## Code map

```
src/
  routes/                 file routes (see src/routes/README.md for conventions)
    api/paystack/webhook  POST: verify x-paystack-signature → confirm_payment
    sitemap[.]xml, robots[.]txt   server routes (dynamic, from the catalogue)
    index, shop, product.$slug, bundles, cart      ← Lovable
    checkout, order.$id, track, account, bulk, safety, delivery
    admin.tsx             admin layout + guard;  admin/*  dashboard, orders, products, inventory,
                          quotes, delivery, availability (kill switch), marketing, reviews, login
  components/site/        storefront components (Shell, ProductCard, Fireworks canvas, Countdown,
                          OrderTimeline, TrackForm, forms.tsx = Field/inputs/StateCityPicker/zod helpers)
  components/admin/ui.tsx admin primitives (PageHeader, Panel, Stat, TableWrap, Toggle, inputs)
  components/ui/          shadcn — don't restyle globally
  lib/
    types.ts              domain types (naira numbers in the UI layer)
    data.ts               constants (STATES, CATEGORIES, OCCASIONS) + the mock seed data that
                          scripts/seed-products.ts copies into Supabase
    db-map.ts             Supabase rows ↔ UI types. The ONLY kobo ↔ naira conversion point
    catalogue.ts          getCatalogue server fn + catalogueQuery + useCatalogue() — the public
                          catalogue (products, bundles, approved reviews, zones, blocks, banners,
                          campaign), loaded in the root loader and dehydrated into the HTML
    services.ts           pure READ helpers over the catalogue (listProducts(cat, …), …)
    admin.functions.ts    admin catalogue writes + admin reads as server fns (zod-validated, RLS)
    admin-write.ts        useAdminWrite(): run a write, toast, refresh the catalogue
    auth.functions.ts     getViewer (server-verified user + role), attachGuestOrders
    auth.tsx              AuthProvider/useAuth: Supabase email+password sign in/up/out, profile
    addresses.ts          useAddresses(): the signed-in user's saved addresses
    supabase.server.ts    supabaseForRequest (cookie session, RLS) · supabasePublic · supabaseService
    supabase.browser.ts   browser client (NOT *.client.ts — import protection denies those to SSR)
    supabase-env.ts       VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
    checkout.functions.ts checkCode, createCheckout (priceCart → place_order → Paystack init),
                          verifyPayment, retryPayment
    orders.functions.ts   getOrder (owner/admin, payment ref, or number+phone → limited view),
                          myOrders, submitQuote, myReviews, submitReview
    payments.server.ts    confirmPayment (confirm_payment + receipt exactly once), verifyAndConfirm,
                          loadOrder
    paystack.server.ts    initialize / verify / webhook signature (+ PAYSTACK_SIMULATE for dev)
    email.server.ts       Resend: receipt, status updates, quote replies (logs when no key)
    tracking.ts           guest tracking phone kept in sessionStorage, never in the URL
    r2.server.ts          R2 presigned PUT (aws4fetch), UPLOAD_RULES (types/sizes per kind)
    uploads.functions.ts  createUpload: product media (admin), review media (signed-in, own folder)
    uploads.ts            uploadFile(kind, file) → public URL (browser)
    turnstile.server.ts   verifyTurnstile (off when TURNSTILE_SECRET_KEY unset)
    site.ts               SITE_URL / absolute() for SEO tags
    checkout.ts           priceCart(): the ONE pricing function (bulk tiers, codes, delivery,
                          kill switch, stock - reserved). Used by cart, checkout and placeOrder
    pricing.ts            tier maths + formatNaira
    store.tsx             per-browser state: cart, wishlist, "deliver to" state, order → payment ref
scripts/seed-products.ts  data.ts catalogue → idempotent SQL (pipe into psql)
scripts/loadtest/         oversell.sql (pgbench race on place_order), k6-december.js
LAUNCH.md                 owner's go-live checklist + December runbook
supabase/
  README.md                            project setup, step by step
  migrations/20261024000000_init.sql   full schema, RLS, stock/payment functions (tested on PG16)
  migrations/20261024010000_phase2.sql pg_cron hold release; set_order_status forward-only
  seed.sql                             categories, occasions, delivery cities, codes, campaign
public/images/products/   the 4 seed/stock images (new uploads go to R2)
```

### Data layer (current state, after Phase 2 — no mock left)

- **Catalogue** (products, bundles, approved reviews, zones, kill switch, banners, campaign):
  `useCatalogue()` / `loadCatalogue(context.queryClient)`, passed to `services.ts` helpers. Admin
  writes: `admin.functions.ts` via `useAdminWrite()`.
- **Orders, quotes, codes, reviews:** server functions only (`checkout.functions.ts`,
  `orders.functions.ts`, admin ones in `admin.functions.ts`), read with TanStack Query
  (`["admin", …]` keys for admin lists; invalidate `["admin"]` after admin actions).
- **Local dev without Paystack:** `PAYSTACK_SIMULATE=1` (see .env.example).
- Admin access: sign in at `/admin/login` with an account whose `profiles.role = 'admin'`
  (see supabase/README.md). `/admin` is guarded in `beforeLoad` with `getViewer()`.

## Architecture (target)

```
Browser ──server fn──▶ Cloudflare Worker (SSR + server functions + /api/paystack/webhook)
                          ├── Supabase Postgres (RLS on every table)
                          ├── Paystack (initialize / verify / webhook)
                          ├── Cloudflare R2 (media, presigned uploads)
                          └── Resend (order emails)
```

- Supabase clients: a **user-scoped** client (anon key + the user's session cookie) for reads the
  user is allowed by RLS, and a **service-role** client used ONLY inside server functions for
  orders, payments, tracking lookups. The service-role key never reaches the browser — keep it in
  `*.server.ts` modules / Worker secrets.
- Catalogue reads (products, bundles, zones, blocks, campaign) can be public anon reads, loaded in
  route `loader`s and cached with TanStack Query.

### Money rules (non-negotiable)

1. The DB stores **kobo** (`bigint`). UI types use naira. Convert at the data boundary only.
2. **The server prices every order itself.** The checkout server function receives only
   `{ lines: [{productId|bundleId, qty}], address, contact, code }`, loads fresh rows, runs
   `priceCart()`, and ignores any totals from the browser.
3. Order creation goes through `place_order()` (row-locks products, checks `stock - reserved`,
   creates `pending_payment` order, reserves stock for 30 min). Never insert orders directly.
4. An order is paid **only** when `confirm_payment()` runs from (a) the Paystack webhook after
   verifying `x-paystack-signature` = HMAC-SHA512 of the raw body with the secret key, or (b) the
   callback page after `GET /transaction/verify/:reference` succeeds. Never from a browser redirect
   alone. `confirm_payment` checks the amount equals `orders.total_kobo` and is idempotent.
5. `release_expired_holds()` runs every 5 min (pg_cron) to cancel unpaid orders and free stock.
6. Pre-order units don't consume stock (exclude them from `p_stock`).

### Checkout flow (Phase 2)

1. `createCheckout` server fn → `priceCart()` → validate (zod) → `place_order()` → insert
   `payments` row (status `pending`, reference `DSKY-<orderNumber>-<rand>`) →
   Paystack `POST /transaction/initialize` (amount in kobo, email, reference, `callback_url`
   `/order/<number>?ref=…`, metadata `{ orderId }`) → return `authorization_url`.
2. Browser redirects to Paystack (or uses Paystack Inline).
3. Webhook `charge.success` → verify signature → `confirm_payment()` → send receipt email.
4. Callback page calls `verifyPayment` (Paystack verify → `confirm_payment()`), then shows the
   celebration screen — same UI as today's `/order/$id?new=true`.

### Auth

- Supabase Auth, email + password (magic link optional). Sign-up metadata `{ full_name, phone }`
  feeds `handle_new_user()`.
- On sign-in, attach guest orders: `update orders set user_id = :uid where user_id is null and
  lower(email) = lower(:email)` — do this in a server function, and only after the email is
  confirmed.
- Admin = `profiles.role = 'admin'`. Promote the owner once in SQL. Guard `/admin/*` in
  `routes/admin.tsx` `beforeLoad` (server-checked) AND rely on RLS. Customers can only update
  `full_name`/`phone` on their profile (column grant) — they can't make themselves admin.
- Guest tracking: `/track` → server fn looks up by order number + last 10 digits of phone with the
  service-role client and returns a minimal projection (no email/full address).

### Media (Phase 3)

Upload to R2 with presigned PUT URLs from a server function (admin for products; signed-in
verified buyers for review media, size/type-limited). Store public URLs in `product_media` /
`review_media`. Product videos: short MP4/WebM (≤ 8 MB, 720p, muted), with a poster image;
only load the video when the user taps play (mobile data matters).

## Database

See `supabase/migrations/20261024000000_init.sql` — it is the source of truth. Tables:

| Area | Tables |
|---|---|
| People | `profiles` (role), `addresses`, `wishlist_items` |
| Catalogue | `categories`, `occasions`, `products` (stock, reserved, preorder_arrives), `product_occasions`, `product_media`, `price_tiers`, `bundles`, `bundle_items` |
| Delivery/compliance | `delivery_cities`, `category_state_blocks` |
| Orders | `orders` (number `DS-10300…`, nullable `user_id` for guests), `order_items` (price snapshots), `stock_reservations`, `order_status_events` (feeds the tracking timeline), `payments` |
| Social proof | `reviews` (unique `order_item_id` = verified purchase), `review_media` |
| Sales/marketing | `bulk_quotes`, `discount_codes`, `banners`, `campaign_settings` (single row) |

Order status enum: `pending_payment → processing → dispatched → out_for_delivery → delivered`
(+ `cancelled`). The UI shows the last four as "Processing / Dispatched / Out for Delivery /
Delivered".

Gotcha: anon can INSERT a bulk quote but not SELECT it, so don't chain `.select()` on that insert.

## Build plan

Work phase by phase on a branch per phase. Keep the mock working until its replacement lands.

- [x] **Phase 0 — UI complete on mock data.** All customer pages + admin, pricing tests.
- [x] **Phase 1 — Supabase + auth.** (Code done; you still create the project — supabase/README.md.) Create project, apply migration + seed, write
  `scripts/seed-products.ts` (from `lib/data.ts`, naira → kobo). Supabase clients
  (`lib/supabase.server.ts`, `lib/supabase.browser.ts`). Swap `services.ts` reads to queries in
  route loaders + TanStack Query. Real auth in `/account` and `/admin/login`. Delete
  `admin-auth.ts` and the user parts of `store.tsx`.
- [x] **Phase 2 — Checkout + Paystack.** (Code done; add Paystack/Resend keys — supabase/README.md.) Server fns `createCheckout`, `verifyPayment`, webhook
  route, Resend emails (receipt, status changes, quote replies), pg_cron for holds. Admin actions
  become server fns. Delete `mock-db.ts`.
- [x] **Phase 3 — Media.** (Code done; create the bucket — supabase/README.md → R2.) R2 presigned uploads for product videos/images and review media.
- [x] **Phase 4 — Launch hardening.** (Code done; the account/dashboard steps are in LAUNCH.md.) Cloudflare Turnstile on bulk-quote + auth forms, rate
  limits, sitemap + Product JSON-LD for SEO, OG images, error monitoring, analytics, Paystack live
  keys, Workers Paid + Supabase Pro, backups, load test the checkout for the December spike.

## Conventions

- Match Lovable's visual language: `glass` panels, `bg-gold-gradient`/`bg-party-gradient`,
  `font-display` (Unbounded) headings, `text-gold` accents, `Button` variants `gold | glass |
  party | paystack`. Admin is calmer: `components/admin/ui.tsx`.
- Colour tokens live in `src/styles.css` (`--gold`, `--magenta`, `--ember`, `--emerald`,
  `--royal`, `--night`). Never hard-code hex in components.
- Forms: zod schema + `issuesToErrors()` + `Field`/`errProps()` for accessible errors. Nigerian
  phone validation: `NG_PHONE`.
- Respect `prefers-reduced-motion` (already global in `styles.css`; canvas code checks it too).
- Copy tone: confident, fun, lightly Nigerian ("Make your December detty", "Light up the owambe"),
  always clear. Prices `formatNaira()` → `₦25,000`.
- Mobile first: test at 390px; no horizontal page scroll (wide tables use `TableWrap`).
- Wrap all `localStorage`/`sessionStorage` access in try/catch.
- Run `npx tsc --noEmit` and `bun run test` before every commit.
