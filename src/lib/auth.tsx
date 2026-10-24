// Customer auth state in the browser (Supabase Auth, email + password).
// Admin access is NOT decided here — routes/admin.tsx checks getViewer() on the server.
import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { attachGuestOrders } from "./auth.functions";
import { supabaseBrowser } from "./supabase.browser";

export interface Profile {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: "customer" | "admin";
}

interface Auth {
  /** undefined while the session is loading (SSR and first paint), null when signed out. */
  user: Profile | null | undefined;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (v: {
    email: string;
    password: string;
    name: string;
    phone: string;
  }) => Promise<{ error: string } | { needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  updateProfile: (v: { name: string; phone: string }) => Promise<string | null>;
}

const Ctx = createContext<Auth | null>(null);

async function loadProfile(session: Session | null): Promise<Profile | null> {
  if (!session) return null;
  const { data } = await supabaseBrowser()
    .from("profiles")
    .select("full_name, phone, role")
    .eq("id", session.user.id)
    .single();
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: data?.full_name ?? "",
    phone: data?.phone ?? "",
    role: data?.role === "admin" ? "admin" : "customer",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null | undefined>(undefined);

  useEffect(() => {
    const sb = supabaseBrowser();
    let alive = true;
    const apply = (s: Session | null) =>
      void loadProfile(s).then((p) => {
        if (alive) setUser(p);
      });
    void sb.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((event, s) => {
      if (event === "INITIAL_SESSION") return;
      apply(s);
      // A confirmed sign-in picks up any orders placed as a guest with the same email.
      if (event === "SIGNED_IN") void attachGuestOrders().catch(() => {});
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabaseBrowser().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    return error ? friendly(error.message) : null;
  }, []);

  const signUp = useCallback<Auth["signUp"]>(async ({ email, password, name, phone }) => {
    const { data, error } = await supabaseBrowser().auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: name.trim(), phone: phone.trim() },
        emailRedirectTo: `${window.location.origin}/account`,
      },
    });
    if (error) return { error: friendly(error.message) };
    return { needsConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    await supabaseBrowser().auth.signOut();
  }, []);

  const updateProfile = useCallback(
    async (v: { name: string; phone: string }) => {
      if (!user) return "You're signed out.";
      const { error } = await supabaseBrowser()
        .from("profiles")
        .update({ full_name: v.name.trim(), phone: v.phone.trim() })
        .eq("id", user.id);
      if (error) return error.message;
      setUser({ ...user, name: v.name.trim(), phone: v.phone.trim() });
      return null;
    },
    [user],
  );

  return (
    <Ctx.Provider value={{ user, signIn, signUp, signOut, updateProfile }}>{children}</Ctx.Provider>
  );
}

export function useAuth() {
  const a = useContext(Ctx);
  if (!a) throw new Error("useAuth outside AuthProvider");
  return a;
}

function friendly(msg: string) {
  if (/invalid login credentials/i.test(msg)) return "Wrong email or password.";
  if (/email not confirmed/i.test(msg))
    return "Confirm your email first — check your inbox for our link.";
  if (/already registered/i.test(msg)) return "That email already has an account. Sign in instead.";
  return msg;
}
