// Auth-related server functions. The session comes from the request cookies that the browser
// client (supabase.browser.ts) sets when the user signs in.
import { createServerFn } from "@tanstack/react-start";
import { supabaseForRequest, supabaseService } from "./supabase.server";

export interface Viewer {
  id: string;
  email: string;
  emailConfirmed: boolean;
  name: string;
  phone: string;
  role: "customer" | "admin";
}

/** The signed-in user, verified with Supabase Auth (getUser, not the unverified cookie). */
export const getViewer = createServerFn({ method: "GET" }).handler(
  async (): Promise<Viewer | null> => {
    const db = supabaseForRequest();
    const { data } = await db.auth.getUser();
    const u = data.user;
    if (!u) return null;
    const { data: profile } = await db
      .from("profiles")
      .select("full_name, phone, role")
      .eq("id", u.id)
      .single();
    return {
      id: u.id,
      email: u.email ?? "",
      emailConfirmed: !!u.email_confirmed_at,
      name: profile?.full_name ?? "",
      phone: profile?.phone ?? "",
      role: profile?.role === "admin" ? "admin" : "customer",
    };
  },
);

/**
 * Gives the signed-in user their guest orders (same email, no owner yet). Only after the email
 * is confirmed — otherwise anyone could sign up with someone else's address and see their orders.
 * Returns how many orders were attached.
 */
export const attachGuestOrders = createServerFn({ method: "POST" }).handler(
  async (): Promise<number> => {
    const { data } = await supabaseForRequest().auth.getUser();
    const u = data.user;
    if (!u?.email || !u.email_confirmed_at) return 0;
    const { data: rows, error } = await supabaseService()
      .from("orders")
      .update({ user_id: u.id })
      .is("user_id", null)
      .ilike("email", u.email.replace(/[\\%_]/g, "\\$&"))
      .select("id");
    if (error) throw new Error(`Attaching orders failed: ${error.message}`);
    return rows.length;
  },
);
