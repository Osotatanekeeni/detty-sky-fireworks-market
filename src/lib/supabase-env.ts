// Supabase project URL + publishable key (public, injected by Vite from VITE_* env vars).
export function supabaseEnv() {
  const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
  const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;
  if (!url || !key)
    throw new Error(
      "Supabase isn't configured: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (see .env.example).",
    );
  return { url, key };
}
