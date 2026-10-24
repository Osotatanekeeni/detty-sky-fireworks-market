# Backend setup (Supabase, Paystack, Resend, R2)

One-time setup for a new environment (dev first, then prod).

1. **Create a project** at <https://supabase.com/dashboard> — region `eu-west-2` (London) or
   `eu-central-1` is closest to Nigeria with Supabase today.
2. **Apply the schema and reference data.** Project Settings → Database → copy the connection
   string (use the *Session pooler* URI), then:

   ```sh
   export SUPABASE_DB_URL='postgresql://postgres.xxxx:PASSWORD@aws-0-eu-west-2.pooler.supabase.com:5432/postgres'
   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261024000000_init.sql
   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261024010000_phase2.sql
   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed.sql
   npx -y bun@1 scripts/seed-products.ts > /tmp/seed-products.sql
   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f /tmp/seed-products.sql
   ```

   (Or paste each file into the SQL editor.) `seed-products.sql` is safe to re-run.
3. **Keys.** Project Settings → API Keys → copy into `.env.local` (see `.env.example`):
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
4. **Auth settings.** Authentication → URL Configuration: Site URL `http://localhost:8080` for dev
   (your domain in prod) and add `/account` under Redirect URLs. Keep "Confirm email" ON —
   guest orders only attach to accounts with a confirmed email.
5. **Make yourself admin.** Sign up at `/account`, confirm the email, then in the SQL editor:

   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'you@example.com');
   ```

   Then sign in at `/admin/login`.

6. **pg_cron.** The phase 2 migration schedules `release_expired_holds()` every 5 minutes. If it
   printed "pg_cron not available", enable pg_cron under Database → Extensions and run:
   `select cron.schedule('release-expired-holds', '*/5 * * * *', 'select public.release_expired_holds()');`
7. **Auth emails.** Authentication → Emails → SMTP: point it at Resend (smtp.resend.com, port 465,
   user `resend`, password = your Resend API key) so confirmation emails come from your domain
   and aren't rate-limited by Supabase's built-in sender.

## Paystack

1. Dashboard → Settings → API Keys & Webhooks. Copy the **test** secret key into
   `PAYSTACK_SECRET_KEY`. Set the webhook URL to `https://<your-domain>/api/paystack/webhook`
   (for local testing, expose port 8080 with `cloudflared tunnel --url http://localhost:8080`).
2. Paystack must approve the business for live payments — fireworks may need extra documents.
   If they decline the category, Kora is the fallback (CLAUDE.md).
3. Without keys, set `PAYSTACK_SIMULATE=1` locally to "pay" instantly (never works in production).

## Resend

Add and verify your domain (DNS records) at resend.com, then set `RESEND_API_KEY` and
`EMAIL_FROM`. Emails sent: order receipt, Dispatched / Out for delivery / Delivered, and bulk
quote replies (with a Paystack link once a quote is converted).

## Cloudflare R2 (product & review media)

1. R2 → Create bucket `detty-media`. Settings → Public access: connect a custom domain
   (e.g. `media.dettysky.ng`; r2.dev is fine for testing) → that's `R2_PUBLIC_URL`.
2. Settings → CORS policy, so browsers can upload straight to R2:

   ```json
   [{ "AllowedOrigins": ["http://localhost:8080", "https://dettysky.ng"],
      "AllowedMethods": ["PUT"], "AllowedHeaders": ["content-type"], "MaxAgeSeconds": 3600 }]
   ```
3. R2 → Manage API tokens → Create token with *Object Read & Write* on this bucket → copy the
   Access Key ID / Secret into `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`; `R2_ACCOUNT_ID` is in
   the R2 overview sidebar.

Limits (enforced server-side and by the signed URL): product photos 5 MB (JPG/PNG/WebP), product
videos 8 MB (MP4/WebM), review photos 5 MB, review videos 20 MB. Re-encode product clips to
720p, muted, a few seconds (`ffmpeg -i in.mov -vf scale=-2:720 -an -c:v libx264 -crf 28 out.mp4`).

Production: set the `VITE_*` values at build time and the server values as Cloudflare Worker
secrets (`npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY`, same for `PAYSTACK_SECRET_KEY`,
`RESEND_API_KEY`, `R2_SECRET_ACCESS_KEY`, `R2_ACCESS_KEY_ID`), plus `SITE_URL` and `EMAIL_FROM` as plain variables.
