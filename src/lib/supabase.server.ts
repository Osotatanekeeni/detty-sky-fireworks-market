// Server-only Supabase clients. Import ONLY from server function handlers / server routes.
//
// - supabaseForRequest(): the caller's session (from cookies) — RLS applies. Use for anything
//   the signed-in user is allowed to do, including admin writes (RLS checks is_admin()).
// - supabasePublic(): no session — public catalogue reads that are the same for everyone.
// - supabaseService(): service role — BYPASSES RLS. Only for orders, payments, tracking
//   lookups and guest-order attachment. The key is a Worker secret and never reaches the browser.
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getCookies, setCookie } from "@tanstack/react-start/server";
import { supabaseEnv } from "./supabase-env";

export function supabaseForRequest(): SupabaseClient {
  const { url, key } = supabaseEnv();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => Object.entries(getCookies()).map(([name, value]) => ({ name, value })),
      setAll: (cookies) => {
        for (const c of cookies) setCookie(c.name, c.value, c.options);
      },
    },
  });
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

let publicClient: SupabaseClient | undefined;
export function supabasePublic(): SupabaseClient {
  if (!publicClient) {
    const { url, key } = supabaseEnv();
    publicClient = createClient(url, key, noSession);
  }
  return publicClient;
}

export function supabaseService(): SupabaseClient {
  const { url } = supabaseEnv();
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set (server secret).");
  return createClient(url, key, noSession);
}
