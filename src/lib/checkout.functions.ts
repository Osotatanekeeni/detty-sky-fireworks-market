// Checkout server functions (CLAUDE.md → "Checkout flow" and "Money rules").
// The browser sends only lines, contact, address and a code. The server re-prices everything
// from fresh database rows with priceCart(), creates the order through place_order() (which
// row-locks stock), and hands back a Paystack payment URL.
import { createServerFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";
import { z } from "zod";
import { fetchCatalogue } from "./catalogue.server";
import { priceCart } from "./checkout";
import { STATES } from "./data";
import { toKobo, codeFromRow, type CodeRow } from "./db-map";
import { initializeTransaction } from "./paystack.server";
import { verifyAndConfirm } from "./payments.server";
import { supabaseForRequest, supabaseService } from "./supabase.server";
import type { DiscountCode, Order } from "./types";

const NG_PHONE = /^(\+?234|0)[789][01]\d{8}$/;

async function findCode(code: string | undefined): Promise<DiscountCode | null> {
  const c = code?.trim().toUpperCase();
  if (!c) return null;
  const { data } = await supabaseService()
    .from("discount_codes")
    .select("code, pct, active, uses, max_uses, expires_at")
    .eq("code", c)
    .maybeSingle();
  if (!data || !data.active) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
  if (data.max_uses != null && data.uses >= data.max_uses) return null;
  return codeFromRow(data as CodeRow);
}

/** Lets the checkout page show a code's discount before paying. The server re-checks at payment. */
export const checkCode = createServerFn({ method: "POST" })
  .validator((code: string) => z.string().max(20).parse(code))
  .handler(async ({ data }): Promise<{ code: string; pct: number } | null> => {
    const c = await findCode(data);
    return c ? { code: c.code, pct: c.pct } : null;
  });

const lineSchema = z
  .object({
    productId: z.string().uuid().optional(),
    bundleId: z.string().uuid().optional(),
    qty: z.number().int().min(1).max(1000),
  })
  .refine((l) => !!l.productId !== !!l.bundleId, "Each line is a product or a bundle");

const checkoutSchema = z.object({
  lines: z.array(lineSchema).min(1).max(50),
  contact: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(200),
    phone: z
      .string()
      .transform((p) => p.replace(/[\s-]/g, ""))
      .refine((p) => NG_PHONE.test(p), "Enter a Nigerian phone number"),
  }),
  address: z.object({
    state: z.enum(STATES as [string, ...string[]]),
    city: z.string().trim().min(1).max(80),
    street: z.string().trim().min(5).max(300),
  }),
  code: z.string().max(20).optional(),
});
export type CheckoutRequest = z.input<typeof checkoutSchema>;

function origin() {
  return (process.env["SITE_URL"] || getRequestUrl().origin).replace(/\/$/, "");
}

export const createCheckout = createServerFn({ method: "POST" })
  .validator((d: CheckoutRequest) => checkoutSchema.parse(d))
  .handler(async ({ data }) => {
    const db = supabaseService();
    const [catalogue, code, viewer] = await Promise.all([
      fetchCatalogue(db),
      findCode(data.code),
      supabaseForRequest().auth.getUser(),
    ]);
    const priced = priceCart(
      { ...catalogue, codes: code ? [code] : [] },
      {
        lines: data.lines,
        state: data.address.state as Order["address"]["state"],
        city: data.address.city,
        code: data.code,
      },
    );
    const problems = [...priced.problems];
    if (priced.codeError) problems.push(priced.codeError);
    if (!catalogue.campaign.preordersOpen && priced.lines.some((l) => l.preorderArrives))
      problems.push("Pre-orders are closed right now.");
    if (priced.lines.length !== data.lines.length)
      problems.push("Some items in your cart are no longer available.");
    if (problems.length) return { ok: false as const, problems };

    // Unpaid orders hold stock for 30 minutes, so cap how many one buyer can have open — stops
    // anyone (or a bot) from locking up December stock with checkouts they never pay for.
    const { count: open } = await db
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_payment")
      .gt("reserved_until", new Date().toISOString())
      .or(`email.eq."${data.contact.email.toLowerCase()}",phone.eq."${data.contact.phone}"`);
    if ((open ?? 0) >= 3)
      return {
        ok: false as const,
        problems: [
          "You have unpaid orders waiting. Pay one from its order page, or try again in 30 minutes.",
        ],
      };

    const subtotal = toKobo(priced.subtotal);
    const bulk = toKobo(priced.bulkDiscount);
    const codeKobo = toKobo(priced.code?.amount ?? 0);
    const fee = toKobo(priced.delivery!.fee);
    const stock = new Map<string, number>();
    for (const l of priced.lines)
      for (const n of l.stockNeeds)
        if (!n.preorder) stock.set(n.productId, (stock.get(n.productId) ?? 0) + n.qty);

    const { data: order, error } = await db.rpc("place_order", {
      p_order: {
        user_id: viewer.data.user?.id ?? "",
        email: data.contact.email.toLowerCase(),
        customer_name: data.contact.name,
        phone: data.contact.phone,
        state: data.address.state,
        city: data.address.city,
        street: data.address.street,
        subtotal_kobo: subtotal,
        bulk_discount_kobo: bulk,
        code: priced.code?.code ?? "",
        code_discount_kobo: codeKobo,
        delivery_fee_kobo: fee,
        total_kobo: subtotal - bulk - codeKobo + fee,
        eta: priced.delivery!.eta,
      },
      p_items: priced.lines.map((l) => ({
        kind: l.kind,
        ...(l.kind === "product" ? { product_id: l.id } : { bundle_id: l.id }),
        name: l.name,
        qty: l.qty,
        unit_price_kobo: Math.round(toKobo(l.total) / l.qty),
        line_total_kobo: toKobo(l.total),
        ...(l.preorderArrives ? { preorder_arrives: l.preorderArrives } : {}),
      })),
      p_stock: [...stock].map(([product_id, qty]) => ({ product_id, qty })),
    });
    if (error) {
      if (error.message.includes("OUT_OF_STOCK"))
        return {
          ok: false as const,
          problems: [
            "Someone just bought the last of an item in your cart. Please refresh and try again.",
          ],
        };
      throw new Error(`Couldn't create the order: ${error.message}`);
    }
    const o = order as { id: string; number: string; total_kobo: number; email: string };

    const reference = `DSKY-${o.number.replace("DS-", "")}-${crypto.randomUUID().slice(0, 8)}`;
    const { error: payErr } = await db
      .from("payments")
      .insert({ order_id: o.id, reference, amount_kobo: o.total_kobo, status: "pending" });
    if (payErr) throw new Error(`Couldn't start payment: ${payErr.message}`);

    const { authorizationUrl } = await initializeTransaction({
      email: o.email,
      amountKobo: Number(o.total_kobo),
      reference,
      callbackUrl: `${origin()}/order/${o.number}`,
      metadata: { orderId: o.id, orderNumber: o.number },
    });
    return { ok: true as const, orderNumber: o.number, reference, authorizationUrl };
  });

/** Called by the order page when Paystack sends the buyer back with ?reference=… */
export const verifyPayment = createServerFn({ method: "POST" })
  .validator((reference: string) => z.string().min(6).max(100).parse(reference))
  .handler(async ({ data }) => {
    const order = await verifyAndConfirm(data);
    return order ? { number: order.id, paid: order.payment?.status === "paid" } : null;
  });

/** "Pay now" for an unpaid order, for whoever holds one of its payment references. */
export const retryPayment = createServerFn({ method: "POST" })
  .validator((d: { number: string; ref: string }) =>
    z.object({ number: z.string().max(20), ref: z.string().min(6).max(100) }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = supabaseService();
    const { data: o } = await db
      .from("orders")
      .select("id, number, email, total_kobo, status, payments(reference)")
      .eq("number", data.number)
      .maybeSingle();
    if (!o || !(o.payments as { reference: string }[]).some((p) => p.reference === data.ref))
      throw new Error("Order not found");
    if (o.status !== "pending_payment")
      throw new Error("This order can't be paid any more — please place a new one.");
    const reference = `DSKY-${o.number.replace("DS-", "")}-${crypto.randomUUID().slice(0, 8)}`;
    const { error } = await db
      .from("payments")
      .insert({ order_id: o.id, reference, amount_kobo: o.total_kobo, status: "pending" });
    if (error) throw new Error(error.message);
    const { authorizationUrl } = await initializeTransaction({
      email: o.email,
      amountKobo: Number(o.total_kobo),
      reference,
      callbackUrl: `${origin()}/order/${o.number}`,
      metadata: { orderId: o.id, orderNumber: o.number },
    });
    return { url: authorizationUrl, reference };
  });
