# Launch checklist

Everything here needs the owner's accounts — the code is ready. Do it on **staging first**
(a second Supabase project + a `staging` Worker), then production. Target: live by 1 December.

## 1. Accounts & plans
- [ ] **Cloudflare Workers Paid** ($5/mo) — the free plan's 10 ms CPU limit is too tight for SSR.
- [ ] **Supabase Pro** ($25/mo) — free projects pause after a week idle. Turn on **Point-in-Time
      Recovery** (Database → Backups) before December; at minimum confirm daily backups exist.
- [ ] **Paystack** business verified and **approved for live payments** (fireworks may need extra
      documents — start early). If refused, Kora is the fallback (CLAUDE.md).
- [ ] **Resend** domain verified (SPF/DKIM DNS records).
- [ ] Domain on Cloudflare: `dettysky.ng` (site) and `media.dettysky.ng` (R2 bucket).

## 2. Configuration (see `.env.example` and `supabase/README.md`)
| Where | Values |
|---|---|
| Build-time vars | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SITE_URL`, `VITE_TURNSTILE_SITE_KEY`, `VITE_CF_ANALYTICS_TOKEN` |
| Worker secrets (`wrangler secret put`) | `SUPABASE_SERVICE_ROLE_KEY`, `PAYSTACK_SECRET_KEY` (**sk_live_…** at launch), `RESEND_API_KEY`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `TURNSTILE_SECRET_KEY` |
| Worker vars | `SITE_URL`, `EMAIL_FROM`, `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_PUBLIC_URL` |

- [ ] **Never** set `PAYSTACK_SIMULATE` outside local dev (production builds ignore it anyway).
- [ ] Paystack webhook URL → `https://dettysky.ng/api/paystack/webhook` (live *and* test mode).
- [ ] Supabase Auth: Site URL = `https://dettysky.ng`, redirect `https://dettysky.ng/account`,
      SMTP via Resend, **Attack Protection → Captcha: Turnstile** with the same secret key.
- [ ] R2 CORS allows `https://dettysky.ng` (PUT).
- [ ] Promote the owner account to admin (supabase/README.md step 5). Use a strong, unique password.

## 3. Abuse protection (Cloudflare dashboard → Security)
Built in: Turnstile on bulk quotes and sign-in/up; max 3 bulk quotes per phone per day; max 3
unpaid orders per email/phone (stops stock-hoarding); unpaid holds expire after 30 min (pg_cron).
Add these WAF **rate limiting rules** (Security → WAF → Rate limiting):
- [ ] `/_serverFn/*` POST: 60 requests / minute / IP → block 10 min.
- [ ] `/api/paystack/webhook`: skip rate limiting (Paystack retries) — signature-checked instead.
- [ ] `/admin*`: 30 requests / minute / IP → managed challenge.
- [ ] Bot Fight Mode on.

## 4. Observability
- [ ] Workers → your worker → **Logs: enable Workers Logs** (payment, webhook and email errors are
      logged with `[paystack webhook]` / `[email]` prefixes).
- [ ] Set up a Cloudflare **notification** for Worker error-rate spikes.
- [ ] Web Analytics: add the site, copy the token into `VITE_CF_ANALYTICS_TOKEN`.
- [ ] Optional: Sentry (or similar) for front-end errors — hook it into
      `src/lib/lovable-error-reporting.ts` / the root `ErrorComponent`.

## 5. SEO
- [ ] Submit `https://dettysky.ng/sitemap.xml` in Google Search Console and Bing Webmaster Tools.
- [ ] Check a product page with Google's Rich Results Test (Product JSON-LD is on every product).

## 6. Pre-launch tests (staging, Paystack **test** keys)
- [ ] Card payment with Paystack's test card → receipt email → order "Processing" → stock down.
- [ ] Bank transfer / USSD test payments; close the Paystack tab mid-payment → order stays
      "Awaiting payment" → "Pay now" works → after 30 min the order cancels and stock returns.
- [ ] Webhook arrives (Paystack dashboard → Webhooks → logs show 200).
- [ ] Admin: dispatch → out for delivery → delivered; customer gets each email; review form opens.
- [ ] Bulk quote → reply → convert → customer pays from the emailed link.
- [ ] Kill switch: block a category in a state → product page and checkout refuse it.
- [ ] Concurrency: `scripts/loadtest/oversell.sql` (no overselling).
- [ ] Load: `k6 run -e BASE=https://staging… scripts/loadtest/k6-december.js` (p95 < 1.5 s).
- [ ] Phone at 390 px: browse → checkout → pay, on a real Nigerian mobile network.

## 7. Go live
- [ ] Swap to `sk_live_…`, redeploy, make one small real purchase, refund it in Paystack.
- [ ] Remove/replace sample products, banners and discount codes from the seed.

## December runbook
- Daily: Orders page — anything "Processing" older than a day? Inventory → low stock.
- If Paystack is down: the store keeps taking orders as "Awaiting payment"; buyers can "Pay now"
  later. Turn pre-orders off (Marketing) if stock is uncertain.
- If police/state restrict a product: State availability → switch the category off for that state.
- Check pg_cron is running: `select * from cron.job_run_details order by start_time desc limit 5;`
