// Admin catalogue writes and admin-only reads, as server functions.
//
// Every function runs with the CALLER's Supabase session (supabaseForRequest), so RLS
// (`is_admin()`) is the real guard. requireAdmin() just turns a silent "0 rows updated" into
// a clear FORBIDDEN error. Inputs are validated with zod on the server — never trust the
// browser's shape. After calling one of these, refresh the catalogue (useRefreshCatalogue).
import { createServerFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { STATES } from "./data";
import {
  ORDER_SELECT,
  QUOTE_SELECT,
  REVIEW_SELECT,
  bannerFromRow,
  codeFromRow,
  orderFromRow,
  quoteFromRow,
  quoteStatusToDb,
  statusToDb,
  toNaira,
  type CodeRow,
  type OrderRow,
  type QuoteRow,
  bannerToRow,
  bundleToRow,
  campaignToRow,
  productMediaRows,
  productToRow,
  reviewFromRow,
  toKobo,
  type BannerRow,
  type ReviewRow,
} from "./db-map";
import { sendQuoteReply, sendStatusUpdate } from "./email.server";
import { initializeTransaction } from "./paystack.server";
import { confirmPayment, loadOrder } from "./payments.server";
import { supabaseForRequest, supabaseService } from "./supabase.server";
import type {
  Banner,
  BulkQuote,
  Bundle,
  Campaign,
  DeliveryZone,
  DiscountCode,
  Order,
  OrderStatus,
  Product,
  QuoteStatus,
  Review,
} from "./types";

async function requireAdmin(): Promise<SupabaseClient> {
  const db = supabaseForRequest();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) throw new Error("FORBIDDEN: sign in first.");
  const { data } = await db.from("profiles").select("role").eq("id", auth.user.id).single();
  if (data?.role !== "admin") throw new Error("FORBIDDEN: admins only.");
  return db;
}

function ok<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what} failed: ${res.error.message}`);
  return res.data;
}

// ── Schemas (mirror types.ts) ───────────────────────────────
const uuid = z.string().uuid();
const naira = z.number().finite().nonnegative();
const state = z.enum(STATES as [string, ...string[]]);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-12-20");

const productSchema = z.object({
  id: uuid,
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  name: z.string().trim().min(2).max(120),
  category: z.string().min(1),
  occasions: z.array(z.string()),
  price: naira.positive(),
  compareAt: naira.optional(),
  image: z.string(),
  gallery: z.array(z.string()),
  videoPoster: z.string(),
  durationSec: z.number().int().nonnegative(),
  shots: z.number().int().nonnegative(),
  heightM: z.number().nonnegative(),
  noise: z.enum(["Quiet", "Medium", "Loud"]),
  colours: z.array(z.string()),
  description: z.string().max(4000),
  stock: z.number().int().nonnegative(),
  reserved: z.number().int().optional(),
  lowStockThreshold: z.number().int().nonnegative(),
  tiers: z.array(
    z.object({ minQty: z.number().int().min(2), discountPct: z.number().int().min(1).max(90) }),
  ),
  preorder: z.object({ arrives: isoDate }).optional(),
  bestSeller: z.boolean().optional(),
});

const bundleSchema = z.object({
  id: uuid,
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  name: z.string().trim().min(2).max(120),
  tagline: z.string().max(200),
  image: z.string(),
  price: naira.positive(),
  items: z.array(z.object({ productId: uuid, qty: z.number().int().positive() })).min(1),
});

const zoneSchema = z.object({
  state,
  cities: z.array(
    z.object({ name: z.string().trim().min(1), fee: naira, days: z.number().int().min(1).max(30) }),
  ),
});

const bannerSchema = z.object({
  id: uuid,
  title: z.string().trim().min(1),
  subtitle: z.string(),
  cta: z.string(),
  href: z.string().startsWith("/"),
  tone: z.enum(["gold", "party", "royal"]),
  active: z.boolean(),
});

const campaignSchema = z.object({
  announcement: z.string().max(200),
  preordersOpen: z.boolean(),
  countdownLabel: z.string().max(120),
});

// ── Products ────────────────────────────────────────────────
export const saveProduct = createServerFn({ method: "POST" })
  .validator((p: Product) => productSchema.parse(p) as Product)
  .handler(async ({ data: p }) => {
    const db = await requireAdmin();
    ok(await db.from("products").upsert(productToRow(p)), "Saving product");
    // Children are replaced wholesale. Not atomic, but each step is idempotent, so saving
    // again fixes a half-applied save.
    ok(await db.from("product_occasions").delete().eq("product_id", p.id), "Saving occasions");
    if (p.occasions.length)
      ok(
        await db
          .from("product_occasions")
          .insert(p.occasions.map((o) => ({ product_id: p.id, occasion_slug: o }))),
        "Saving occasions",
      );
    ok(await db.from("product_media").delete().eq("product_id", p.id), "Saving images");
    const media = productMediaRows(p);
    if (media.length) ok(await db.from("product_media").insert(media), "Saving images");
    ok(await db.from("price_tiers").delete().eq("product_id", p.id), "Saving price tiers");
    if (p.tiers.length)
      ok(
        await db.from("price_tiers").insert(
          p.tiers.map((t) => ({
            product_id: p.id,
            min_qty: t.minQty,
            discount_pct: t.discountPct,
          })),
        ),
        "Saving price tiers",
      );
  });

/** Products are archived, not deleted: past orders and bundles still point at them. */
export const deleteProduct = createServerFn({ method: "POST" })
  .validator((id: string) => uuid.parse(id))
  .handler(async ({ data: id }) => {
    const db = await requireAdmin();
    ok(await db.from("products").update({ is_active: false }).eq("id", id), "Removing product");
  });

export const setStock = createServerFn({ method: "POST" })
  .validator((d: { id: string; stock?: number; lowStockThreshold?: number }) =>
    z
      .object({
        id: uuid,
        stock: z.number().int().nonnegative().optional(),
        lowStockThreshold: z.number().int().nonnegative().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await requireAdmin();
    ok(
      await db
        .from("products")
        .update({
          ...(data.stock != null ? { stock: data.stock } : {}),
          ...(data.lowStockThreshold != null
            ? { low_stock_threshold: data.lowStockThreshold }
            : {}),
        })
        .eq("id", data.id),
      "Updating stock",
    );
  });

// ── Bundles ─────────────────────────────────────────────────
export const saveBundle = createServerFn({ method: "POST" })
  .validator((b: Bundle) => bundleSchema.parse(b) as Bundle)
  .handler(async ({ data: b }) => {
    const db = await requireAdmin();
    ok(await db.from("bundles").upsert(bundleToRow(b)), "Saving bundle");
    ok(await db.from("bundle_items").delete().eq("bundle_id", b.id), "Saving bundle items");
    ok(
      await db
        .from("bundle_items")
        .insert(b.items.map((i) => ({ bundle_id: b.id, product_id: i.productId, qty: i.qty }))),
      "Saving bundle items",
    );
  });

export const deleteBundle = createServerFn({ method: "POST" })
  .validator((id: string) => uuid.parse(id))
  .handler(async ({ data: id }) => {
    const db = await requireAdmin();
    ok(await db.from("bundles").update({ is_active: false }).eq("id", id), "Removing bundle");
  });

// ── Delivery & compliance ───────────────────────────────────
/** Replaces one state's city list. */
export const saveZone = createServerFn({ method: "POST" })
  .validator((z0: DeliveryZone) => zoneSchema.parse(z0) as DeliveryZone)
  .handler(async ({ data: zone }) => {
    const db = await requireAdmin();
    if (zone.cities.length)
      ok(
        await db.from("delivery_cities").upsert(
          zone.cities.map((c) => ({
            state: zone.state,
            name: c.name,
            fee_kobo: toKobo(c.fee),
            days: c.days,
            is_active: true,
          })),
          { onConflict: "state,name" },
        ),
        "Saving cities",
      );
    const keep = zone.cities.map((c) => c.name);
    let del = db.from("delivery_cities").delete().eq("state", zone.state);
    if (keep.length)
      del = del.not("name", "in", `(${keep.map((n) => `"${n.replace(/"/g, '""')}"`).join(",")})`);
    ok(await del, "Removing cities");
  });

export const toggleCategoryBlock = createServerFn({ method: "POST" })
  .validator((d: { state: string; category: string }) =>
    z.object({ state, category: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = await requireAdmin();
    const match = { state: data.state, category_slug: data.category };
    const { data: existing } = await db.from("category_state_blocks").select("state").match(match);
    if (existing?.length)
      ok(await db.from("category_state_blocks").delete().match(match), "Unblocking");
    else ok(await db.from("category_state_blocks").insert(match), "Blocking");
  });

// ── Marketing ───────────────────────────────────────────────
/** All banners, including inactive ones (the catalogue only carries active banners). */
export const listBanners = createServerFn({ method: "GET" }).handler(
  async (): Promise<Banner[]> => {
    const db = await requireAdmin();
    const rows = ok(await db.from("banners").select("*").order("sort"), "Loading banners");
    return (rows as BannerRow[]).map(bannerFromRow);
  },
);

export const saveBanner = createServerFn({ method: "POST" })
  .validator(
    (d: { banner: Banner; sort: number }) =>
      z.object({ banner: bannerSchema, sort: z.number().int() }).parse(d) as {
        banner: Banner;
        sort: number;
      },
  )
  .handler(async ({ data }) => {
    const db = await requireAdmin();
    ok(await db.from("banners").upsert(bannerToRow(data.banner, data.sort)), "Saving banner");
  });

export const deleteBanner = createServerFn({ method: "POST" })
  .validator((id: string) => uuid.parse(id))
  .handler(async ({ data: id }) => {
    const db = await requireAdmin();
    ok(await db.from("banners").delete().eq("id", id), "Deleting banner");
  });

export const saveCampaign = createServerFn({ method: "POST" })
  .validator((c: Campaign) => campaignSchema.parse(c))
  .handler(async ({ data }) => {
    const db = await requireAdmin();
    ok(await db.from("campaign_settings").upsert(campaignToRow(data)), "Saving campaign");
  });

// ── Reviews ─────────────────────────────────────────────────
/** Every review, any status, newest first (the catalogue only carries approved ones). */
export const listReviews = createServerFn({ method: "GET" }).handler(
  async (): Promise<Review[]> => {
    const db = await requireAdmin();
    const rows = ok(
      await db.from("reviews").select(REVIEW_SELECT).order("created_at", { ascending: false }),
      "Loading reviews",
    );
    return (rows as unknown as ReviewRow[]).map(reviewFromRow);
  },
);

export const setReviewStatus = createServerFn({ method: "POST" })
  .validator((d: { id: string; status: Review["status"] }) =>
    z.object({ id: uuid, status: z.enum(["approved", "hidden", "pending"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = await requireAdmin();
    ok(
      await db.from("reviews").update({ status: data.status }).eq("id", data.id),
      "Updating review",
    );
  });

export const newId = () => crypto.randomUUID();

// ── Orders (Phase 2) ────────────────────────────────────────
const orderStatus = z.enum(["Processing", "Dispatched", "Out for Delivery", "Delivered"]);

export const listOrders = createServerFn({ method: "GET" }).handler(async (): Promise<Order[]> => {
  const db = await requireAdmin();
  const rows = ok(
    await db
      .from("orders")
      .select(ORDER_SELECT)
      .order("created_at", { ascending: false })
      .limit(500),
    "Loading orders",
  );
  return (rows as unknown as OrderRow[]).map((r) => orderFromRow(r));
});

export const getAdminOrder = createServerFn({ method: "GET" })
  .validator((n: string) => z.string().max(20).parse(n))
  .handler(async ({ data }): Promise<Order | null> => {
    await requireAdmin();
    return loadOrder({ number: data.toUpperCase() });
  });

/** Moves a paid order along the delivery timeline and emails the customer. */
export const setOrderStatus = createServerFn({ method: "POST" })
  .validator((d: { orderId: string; status: OrderStatus }) =>
    z.object({ orderId: uuid, status: orderStatus }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = await requireAdmin();
    ok(
      await db.rpc("set_order_status", {
        p_order: data.orderId,
        p_status: statusToDb(data.status),
      }),
      "Updating status",
    );
    const order = await loadOrder({ id: data.orderId });
    if (order) await sendStatusUpdate(order);
    return order;
  });

/** For money that arrived outside Paystack (e.g. a direct bank transfer the owner has seen). */
export const markOrderPaid = createServerFn({ method: "POST" })
  .validator((orderId: string) => uuid.parse(orderId))
  .handler(async ({ data: orderId }) => {
    await requireAdmin();
    const svc = supabaseService();
    const { data: o } = await svc
      .from("orders")
      .select("number, total_kobo, status")
      .eq("id", orderId)
      .single();
    if (!o) throw new Error("Order not found");
    const reference = `MANUAL-${o.number}-${crypto.randomUUID().slice(0, 6)}`;
    ok(
      await svc.from("payments").insert({
        order_id: orderId,
        provider: "manual",
        reference,
        amount_kobo: o.total_kobo,
        status: "pending",
      }),
      "Recording payment",
    );
    return confirmPayment(reference, Number(o.total_kobo), "manual", { markedBy: "admin" });
  });

/** A fresh Paystack link for an unpaid order (bulk quotes, or a buyer whose payment failed). */
export const createPaymentLink = createServerFn({ method: "POST" })
  .validator((orderId: string) => uuid.parse(orderId))
  .handler(async ({ data: orderId }) => {
    await requireAdmin();
    return paymentLinkFor(orderId);
  });

async function paymentLinkFor(orderId: string) {
  const svc = supabaseService();
  const { data: o } = await svc
    .from("orders")
    .select("id, number, email, total_kobo, status")
    .eq("id", orderId)
    .single();
  if (!o) throw new Error("Order not found");
  if (o.status !== "pending_payment") throw new Error("This order isn't awaiting payment.");
  if (!o.email) throw new Error("Add the customer's email first — Paystack needs one.");
  const reference = `DSKY-${o.number.replace("DS-", "")}-${crypto.randomUUID().slice(0, 8)}`;
  ok(
    await svc
      .from("payments")
      .insert({ order_id: o.id, reference, amount_kobo: o.total_kobo, status: "pending" }),
    "Creating payment",
  );
  const site = (process.env["SITE_URL"] || getRequestUrl().origin).replace(/\/$/, "");
  const { authorizationUrl } = await initializeTransaction({
    email: o.email,
    amountKobo: Number(o.total_kobo),
    reference,
    callbackUrl: `${site}/order/${o.number}`,
    metadata: { orderId: o.id, orderNumber: o.number },
  });
  return { url: authorizationUrl, reference };
}

// ── Bulk quotes ─────────────────────────────────────────────
export const listQuotes = createServerFn({ method: "GET" }).handler(
  async (): Promise<BulkQuote[]> => {
    const db = await requireAdmin();
    const rows = ok(
      await db.from("bulk_quotes").select(QUOTE_SELECT).order("created_at", { ascending: false }),
      "Loading quotes",
    );
    return (rows as unknown as QuoteRow[]).map(quoteFromRow);
  },
);

export const updateQuote = createServerFn({ method: "POST" })
  .validator(
    (d: {
      id: string;
      status?: QuoteStatus;
      response?: string;
      quotedAmount?: number;
      notify?: boolean;
    }) =>
      z
        .object({
          id: uuid,
          status: z.enum(["New", "Quoted", "Closed"]).optional(),
          response: z.string().max(4000).optional(),
          quotedAmount: naira.positive().optional(),
          notify: z.boolean().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await requireAdmin();
    const rows = ok(
      await db
        .from("bulk_quotes")
        .update({
          ...(data.status ? { status: quoteStatusToDb(data.status) } : {}),
          ...(data.response != null ? { response: data.response } : {}),
          ...(data.quotedAmount != null ? { quoted_kobo: toKobo(data.quotedAmount) } : {}),
        })
        .eq("id", data.id)
        .select(QUOTE_SELECT),
      "Updating quote",
    );
    const q = quoteFromRow((rows as unknown as QuoteRow[])[0]!);
    if (data.notify && q.response)
      await sendQuoteReply({
        name: q.name,
        email: q.email,
        request: q.request,
        response: q.response,
        amount: q.quotedAmount,
      });
    return q;
  });

/** Accepted quote → an order awaiting payment (held 14 days) + a Paystack link emailed to the buyer. */
export const convertQuoteToOrder = createServerFn({ method: "POST" })
  .validator((id: string) => uuid.parse(id))
  .handler(async ({ data: id }) => {
    await requireAdmin();
    const svc = supabaseService();
    const { data: q } = await svc.from("bulk_quotes").select("*").eq("id", id).single();
    if (!q) throw new Error("Quote not found");
    if (!q.quoted_kobo) throw new Error("Set a quoted amount first.");
    if (q.order_id) throw new Error("This quote already has an order.");
    const { data: city } = await svc
      .from("delivery_cities")
      .select("days")
      .eq("state", q.state)
      .eq("name", q.city)
      .maybeSingle();
    const eta = new Date();
    eta.setDate(eta.getDate() + (city?.days ?? 3));
    const { data: order, error } = await svc.rpc("place_order", {
      p_order: {
        email: q.email ?? "",
        customer_name: q.name,
        phone: q.phone,
        state: q.state,
        city: q.city,
        street: "To be confirmed",
        subtotal_kobo: q.quoted_kobo,
        bulk_discount_kobo: 0,
        code_discount_kobo: 0,
        delivery_fee_kobo: 0,
        total_kobo: q.quoted_kobo,
        eta: eta.toISOString().slice(0, 10),
      },
      p_items: [
        {
          kind: "custom",
          name: `Bulk order — ${q.request}`.slice(0, 200),
          qty: 1,
          unit_price_kobo: q.quoted_kobo,
          line_total_kobo: q.quoted_kobo,
        },
      ],
      p_stock: [],
      p_hold: "14 days",
    });
    if (error) throw new Error(`Couldn't create the order: ${error.message}`);
    const o = order as { id: string; number: string };
    ok(
      await svc
        .from("orders")
        .update({ quote_id: id, note: q.response ?? "" })
        .eq("id", o.id),
      "Linking quote",
    );
    ok(
      await svc.from("bulk_quotes").update({ status: "converted", order_id: o.id }).eq("id", id),
      "Updating quote",
    );
    let paymentUrl: string | undefined;
    if (q.email) {
      paymentUrl = (await paymentLinkFor(o.id)).url;
      await sendQuoteReply({
        name: q.name,
        email: q.email,
        request: q.request,
        response: q.response ?? "Your order is ready — pay below to confirm.",
        amount: toNaira(q.quoted_kobo),
        paymentUrl,
      });
    }
    return { number: o.number, paymentUrl };
  });

// ── Discount codes ──────────────────────────────────────────
export const listCodes = createServerFn({ method: "GET" }).handler(
  async (): Promise<DiscountCode[]> => {
    const db = await requireAdmin();
    const rows = ok(
      await db
        .from("discount_codes")
        .select("code, pct, active, uses")
        .order("created_at", { ascending: false }),
      "Loading codes",
    );
    return (rows as CodeRow[]).map(codeFromRow);
  },
);

export const saveCode = createServerFn({ method: "POST" })
  .validator((c: { code: string; pct: number; active: boolean }) =>
    z
      .object({
        code: z.string().regex(/^[A-Z0-9]{3,20}$/),
        pct: z.number().int().min(1).max(50),
        active: z.boolean(),
      })
      .parse(c),
  )
  .handler(async ({ data }) => {
    const db = await requireAdmin();
    ok(await db.from("discount_codes").upsert(data, { onConflict: "code" }), "Saving code");
  });

/** Codes used by orders are deactivated instead (orders keep a reference to them). */
export const deleteCode = createServerFn({ method: "POST" })
  .validator((code: string) => z.string().max(20).parse(code))
  .handler(async ({ data }) => {
    const db = await requireAdmin();
    const { data: used } = await db.from("discount_codes").select("uses").eq("code", data).single();
    if (used && used.uses > 0)
      ok(
        await db.from("discount_codes").update({ active: false }).eq("code", data),
        "Deactivating code",
      );
    else ok(await db.from("discount_codes").delete().eq("code", data), "Deleting code");
  });
