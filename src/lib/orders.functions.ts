// Customer-facing order reads, bulk quote submission and reviews.
//
// Who may see an order (getOrder):
//   - its signed-in owner, or an admin → full details
//   - someone holding one of its Paystack references (the buyer right after paying; the order
//     page keeps it in localStorage) → full details
//   - someone who knows the order number + the phone used at checkout → limited (no email,
//     no street) — that's the guest tracking path
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { STATES } from "./data";
import { ORDER_SELECT, orderFromRow, type OrderRow } from "./db-map";
import { loadOrder } from "./payments.server";
import { supabaseForRequest, supabasePublic, supabaseService } from "./supabase.server";
import { verifyTurnstile } from "./turnstile.server";
import type { Order } from "./types";

const digits = (s: string) => s.replace(/\D/g, "").slice(-10);
const orderNumber = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^DS-\d{3,9}$/, "Order numbers look like DS-10300");

async function viewerInfo() {
  const db = supabaseForRequest();
  const { data } = await db.auth.getUser();
  if (!data.user) return { userId: null, admin: false };
  const { data: p } = await db.from("profiles").select("role").eq("id", data.user.id).single();
  return { userId: data.user.id, admin: p?.role === "admin" };
}

export const getOrder = createServerFn({ method: "POST" })
  .validator((d: { number: string; ref?: string | undefined; phone?: string | undefined }) =>
    z
      .object({
        number: orderNumber,
        ref: z.string().max(100).optional(),
        phone: z.string().max(30).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<Order | null> => {
    const db = supabaseService();
    const { data: row } = await db
      .from("orders")
      .select("id, user_id, phone, payments(reference)")
      .eq("number", data.number)
      .maybeSingle();
    if (!row) return null;
    const v = await viewerInfo();
    const full =
      v.admin ||
      (v.userId && row.user_id === v.userId) ||
      (!!data.ref &&
        (row.payments as { reference: string }[]).some((p) => p.reference === data.ref));
    if (full) return loadOrder({ id: row.id });
    if (data.phone && digits(data.phone).length === 10 && digits(data.phone) === digits(row.phone))
      return loadOrder({ id: row.id }, true);
    return null;
  });

/** The signed-in customer's orders (RLS: own orders only), newest first. */
export const myOrders = createServerFn({ method: "GET" }).handler(async (): Promise<Order[]> => {
  const { data, error } = await supabaseForRequest()
    .from("orders")
    .select(ORDER_SELECT)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data as unknown as OrderRow[]).map((r) => orderFromRow(r));
});

// ── Bulk quotes ─────────────────────────────────────────────
const quoteSchema = z.object({
  name: z.string().trim().min(2).max(120),
  orgType: z.string().trim().min(2).max(60),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  state: z.enum(STATES as [string, ...string[]]),
  city: z.string().trim().min(1).max(80),
  request: z.string().trim().min(5).max(2000),
  quantity: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(7).max(30),
  email: z.string().trim().email().max(200).optional(),
  notes: z.string().max(2000).default(""),
  turnstileToken: z.string().max(4096).optional(),
});
export type QuoteRequest = z.input<typeof quoteSchema>;

/** Anyone can submit (RLS allows anon insert) — behind Turnstile and 3 per phone per day. */
export const submitQuote = createServerFn({ method: "POST" })
  .validator((d: QuoteRequest) => quoteSchema.parse(d))
  .handler(async ({ data }) => {
    await verifyTurnstile(data.turnstileToken);
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { count } = await supabaseService()
      .from("bulk_quotes")
      .select("id", { count: "exact", head: true })
      .eq("phone", data.phone)
      .gte("created_at", since);
    if ((count ?? 0) >= 3)
      throw new Error("We've already got your requests — we'll reply within 24 hours. Chat with us on WhatsApp if it's urgent.");
    // anon can INSERT but not SELECT a quote, so no .select() here.
    const { error } = await supabasePublic()
      .from("bulk_quotes")
      .insert({
        name: data.name,
        org_type: data.orgType,
        event_date: data.eventDate,
        state: data.state,
        city: data.city,
        request: data.request,
        quantity: data.quantity,
        phone: data.phone,
        email: data.email ?? null,
        notes: data.notes,
      });
    if (error) throw new Error(`Couldn't send your request: ${error.message}`);
    return { ok: true };
  });

// ── Reviews ─────────────────────────────────────────────────
export interface MyReview {
  orderItemId: string;
  rating: number;
  status: "pending" | "approved" | "hidden";
}

export const myReviews = createServerFn({ method: "GET" }).handler(
  async (): Promise<MyReview[]> => {
    const db = supabaseForRequest();
    const { data: u } = await db.auth.getUser();
    if (!u.user) return [];
    const { data } = await db
      .from("reviews")
      .select("order_item_id, rating, status")
      .eq("user_id", u.user.id);
    return (data ?? []).map((r) => ({
      orderItemId: r.order_item_id,
      rating: r.rating,
      status: r.status,
    }));
  },
);

/** RLS only accepts reviews for the caller's own delivered order item; status always starts pending. */
export const submitReview = createServerFn({ method: "POST" })
  .validator(
    (d: {
      orderItemId: string;
      productId: string;
      rating: number;
      title: string;
      body: string;
      media?: { type: "photo" | "video"; src: string }[];
    }) =>
      z
        .object({
          orderItemId: z.string().uuid(),
          productId: z.string().uuid(),
          rating: z.number().int().min(1).max(5),
          title: z.string().trim().min(3).max(120),
          body: z.string().trim().min(10).max(4000),
          media: z
            .array(z.object({ type: z.enum(["photo", "video"]), src: z.string().url() }))
            .max(4)
            .default([]),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    const db = supabaseForRequest();
    const { data: u } = await db.auth.getUser();
    if (!u.user) throw new Error("Sign in to leave a review.");
    const uid = u.user.id;
    // Media must be files this user uploaded through createUpload (reviews/<uid>/…).
    const base = (process.env["R2_PUBLIC_URL"] ?? "").replace(/\/$/, "");
    if (data.media.some((m) => !base || !m.src.startsWith(`${base}/reviews/${uid}/`)))
      throw new Error("Please re-upload your photos.");
    const { data: prof } = await db.from("profiles").select("full_name").eq("id", uid).single();
    const { data: item } = await db
      .from("order_items")
      .select("orders(city)")
      .eq("id", data.orderItemId)
      .maybeSingle();
    const [first, last = ""] = (prof?.full_name?.trim() || "Customer").split(/\s+/);
    const { data: review, error } = await db
      .from("reviews")
      .insert({
        product_id: data.productId,
        order_item_id: data.orderItemId,
        user_id: uid,
        rating: data.rating,
        title: data.title,
        body: data.body,
        author_display: `${first} ${last ? `${last[0]}.` : ""}`.trim(),
        city: (item?.orders as { city?: string } | null)?.city ?? "",
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") throw new Error("You've already reviewed this item.");
      if (error.code === "42501") throw new Error("You can review items once they're delivered.");
      throw new Error(error.message);
    }
    if (data.media.length) {
      const { error: mErr } = await db
        .from("review_media")
        .insert(data.media.map((m) => ({ review_id: review.id, kind: m.type, url: m.src })));
      if (mErr) throw new Error(`Review saved, but the photos didn't attach: ${mErr.message}`);
    }
    return { ok: true };
  });
