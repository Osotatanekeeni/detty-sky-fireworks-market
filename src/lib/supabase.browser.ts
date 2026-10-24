// Browser Supabase client (publishable key + the user's session cookie). Safe to ship:
// everything it can do is limited by RLS. Create it only in event handlers and effects. Use for auth (sign in/up/out) and the signed-in
// user's own rows (profile, addresses). Never import the service-role client in the browser.
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./supabase-env";

let client: SupabaseClient | undefined;
export function supabaseBrowser(): SupabaseClient {
  if (!client) {
    const { url, key } = supabaseEnv();
    client = createBrowserClient(url, key);
  }
  return client;
}
