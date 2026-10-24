// Mock write actions for orders, quotes, discount codes and review submissions. These become
// server functions in Phase 2 (checkout + Paystack). Catalogue writes already moved to
// admin.functions.ts.
import { priceCart, type CartInputLine, type PricingTables } from "./checkout";
import { db } from "./mock-db";
import type {
  Address,
  BulkQuote,
  DeliveryZone,
  DiscountCode,
  Order,
  OrderStatus,
  Payment,
  QuoteStatus,
  Review,
} from "./types";

const nowIso = () => new Date().toISOString();
const newId = (prefix: string) =>
  `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function nextOrderId() {
  const nums = db.get().orders.map((o) => Number(o.id.replace(/\D/g, "")) || 0);
  return `DS-${Math.max(10240, ...nums) + 1}`;
}

export class CheckoutError extends Error {
  constructor(public problems: string[]) {
    super(problems.join(" "));
  }
}

export interface PlaceOrderInput {
  lines: CartInputLine[];
  customer: { name: string; email: string; phone: string };
  address: Omit<Address, "id" | "label" | "phone">;
  code?: string | undefined;
  channel: Payment["channel"];
}

/**
 * Mock of the real flow: (1) server re-prices the cart, (2) reserves stock and creates a
 * `pending` order, (3) Paystack webhook marks it paid. Here we do all three at once, and
 * stock isn't touched (it lives in Supabase now; place_order() takes it in Phase 2).
 */
export function placeOrder(catalogue: Omit<PricingTables, "codes">, input: PlaceOrderInput): Order {
  const s = db.get();
  const priced = priceCart({ ...catalogue, codes: s.codes }, {
    lines: input.lines,
    state: input.address.state,
    city: input.address.city,
    code: input.code,
  });
  if (priced.problems.length || priced.codeError)
    throw new CheckoutError([...priced.problems, ...(priced.codeError ? [priced.codeError] : [])]);

  const at = nowIso();
  const order: Order = {
    id: nextOrderId(),
    createdAt: at,
    customer: { ...input.customer },
    address: { ...input.address },
    lines: priced.lines.map((l) => ({
      productId: l.id,
      kind: l.kind,
      name: l.name,
      qty: l.qty,
      unitPrice: l.qty ? Math.round(l.total / l.qty) : l.unit,
      ...(l.preorderArrives ? { preorderArrives: l.preorderArrives } : {}),
    })),
    subtotal: priced.subtotal,
    discount: priced.bulkDiscount,
    deliveryFee: priced.delivery!.fee,
    total: priced.total,
    status: "Processing",
    history: [{ status: "Processing", at }],
    eta: priced.delivery!.eta,
    payment: {
      provider: "paystack",
      reference: `DSKY-${Date.now().toString(36).toUpperCase()}`,
      channel: input.channel,
      status: "paid",
      paidAt: at,
    },
    ...(priced.code ? { code: priced.code.code, codeDiscount: priced.code.amount } : {}),
  };

  db.set((st) => ({
    orders: [order, ...st.orders],
    codes: priced.code
      ? st.codes.map((c) => (c.code === priced.code!.code ? { ...c, uses: c.uses + 1 } : c))
      : st.codes,
  }));
  return order;
}

export function updateOrderStatus(id: string, status: OrderStatus) {
  db.set((s) => ({
    orders: s.orders.map((o) =>
      o.id === id && o.status !== status
        ? { ...o, status, history: [...o.history, { status, at: nowIso() }] }
        : o,
    ),
  }));
}

export function markOrderPaid(id: string) {
  db.set((s) => ({
    orders: s.orders.map((o) =>
      o.id === id && o.payment
        ? { ...o, payment: { ...o.payment, status: "paid", paidAt: nowIso() } }
        : o,
    ),
  }));
}

// ── Bulk quotes ─────────────────────────────────────────────
export type QuoteInput = Omit<
  BulkQuote,
  "id" | "status" | "createdAt" | "response" | "quotedAmount" | "orderId"
>;
export function submitQuote(input: QuoteInput): BulkQuote {
  const q: BulkQuote = {
    ...input,
    id: newId("q"),
    status: "New",
    createdAt: nowIso().slice(0, 10),
  };
  db.set((s) => ({ quotes: [q, ...s.quotes] }));
  return q;
}

export function updateQuote(
  id: string,
  patch: Partial<Pick<BulkQuote, "status" | "response" | "quotedAmount">>,
) {
  db.set((s) => ({ quotes: s.quotes.map((q) => (q.id === id ? { ...q, ...patch } : q)) }));
}

/** Turns an accepted quote into an order awaiting payment (admin sends a Paystack payment link). */
export function convertQuoteToOrder(zones: DeliveryZone[], id: string): Order | undefined {
  const q = db.get().quotes.find((x) => x.id === id);
  if (!q || !q.quotedAmount) return undefined;
  const zone = zones.find((z) => z.state === q.state);
  const city = zone?.cities.find((c) => c.name === q.city) ?? zone?.cities[0];
  const at = nowIso();
  const eta = new Date();
  eta.setDate(eta.getDate() + (city?.days ?? 3));
  const order: Order = {
    id: nextOrderId(),
    createdAt: at,
    customer: { name: q.name, email: q.email ?? "", phone: q.phone },
    address: { state: q.state, city: q.city, street: "To be confirmed" },
    lines: [
      {
        productId: "custom",
        kind: "custom",
        name: `Bulk order — ${q.request}`,
        qty: 1,
        unitPrice: q.quotedAmount,
      },
    ],
    subtotal: q.quotedAmount,
    discount: 0,
    deliveryFee: 0,
    total: q.quotedAmount,
    status: "Processing",
    history: [{ status: "Processing", at }],
    eta: eta.toISOString().slice(0, 10),
    payment: {
      provider: "paystack",
      reference: `DSKY-Q${Date.now().toString(36).toUpperCase()}`,
      channel: "manual",
      status: "pending",
    },
    quoteId: q.id,
    note: q.response ?? "",
  };
  db.set((s) => ({
    orders: [order, ...s.orders],
    quotes: s.quotes.map((x) =>
      x.id === id ? { ...x, status: "Converted" as QuoteStatus, orderId: order.id } : x,
    ),
  }));
  return order;
}

// ── Reviews ─────────────────────────────────────────────────
export function submitReview(input: Omit<Review, "id" | "date" | "status" | "verified">): Review {
  const r: Review = {
    ...input,
    id: newId("r"),
    date: nowIso().slice(0, 10),
    verified: true,
    status: "pending",
  };
  db.set((s) => ({ reviews: [r, ...s.reviews] }));
  return r;
}
// ── Marketing ───────────────────────────────────────────────
export function saveCode(c: DiscountCode) {
  db.set((s) => ({
    codes: s.codes.some((x) => x.code === c.code)
      ? s.codes.map((x) => (x.code === c.code ? c : x))
      : [c, ...s.codes],
  }));
}
export function deleteCode(code: string) {
  db.set((s) => ({ codes: s.codes.filter((c) => c.code !== code) }));
}
