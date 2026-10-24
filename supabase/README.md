# Supabase setup

One-time setup for a new environment (dev first, then prod).

1. **Create a project** at <https://supabase.com/dashboard> — region `eu-west-2` (London) or
   `eu-central-1` is closest to Nigeria with Supabase today.
2. **Apply the schema and reference data.** Project Settings → Database → copy the connection
   string (use the *Session pooler* URI), then:

   ```sh
   export SUPABASE_DB_URL='postgresql://postgres.xxxx:PASSWORD@aws-0-eu-west-2.pooler.supabase.com:5432/postgres'
   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261024000000_init.sql
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

Production: set the same three values as Cloudflare Worker variables (`VITE_*` at build time,
`SUPABASE_SERVICE_ROLE_KEY` as a secret: `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY`).
