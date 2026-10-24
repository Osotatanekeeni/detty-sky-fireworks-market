// Cart pricing — the single source of truth for what an order costs.
//
// Pure function over the database tables so it runs identically in the browser (to show
// totals) and on the server (to create the order). When Paystack goes live, the server
// MUST call this itself with the cart from the request and ignore any totals the browser
// sends. See CLAUDE.md → "Money rules".
import { lineTotals } from "./pricing";
import type { Catalogue } from "./catalogue";
import type { DbState } from "./mock-db";
import type { CategorySlug, StateName } from "./types";

export interface CartInputLine {
  productId?: string | undefined;
  bundleId?: string | undefined;
  qty: number;
}
export interface CheckoutInput {
  lines: CartInputLine[];
  state?: StateName | undefined;
  city?: string | undefined;
  code?: string | undefined;
}

export interface PricedLine {
  key: string;
  kind: "product" | "bundle";
  id: string;
  name: string;
  image: string;
  qty: number;
  unit: number;
  full: number;
  total: number;
  discount: number;
  preorderArrives?: string;
  categories: CategorySlug[];
  /** Units needed per product id (bundles expand to their items). */
  stockNeeds: { productId: string; qty: number; preorder: boolean }[];
}

export interface PricedCart {
  lines: PricedLine[];
  subtotal: number;
  bulkDiscount: number;
  code?: { code: string; pct: number; amount: number };
  codeError?: string;
  delivery?: { fee: number; days: number; eta: string };
  total: number;
  /** Lines that can't be delivered to the chosen state because of a category block. */
  blocked: { name: string; category: CategorySlug }[];
  /** Products without enough stock for this order. */
  outOfStock: { name: string; available: number; requested: number }[];
  /** Human-readable reasons the order can't be placed yet (empty = OK to pay). */
  problems: string[];
}

export type PricingTables = Pick<Catalogue, "products" | "bundles" | "zones" | "blocks"> & Pick<DbState, "codes">;

export function priceCart(t: PricingTables, input: CheckoutInput, now = new Date()): PricedCart {
  const lines: PricedLine[] = [];
  for (const l of input.lines) {
    const qty = Math.max(1, Math.floor(l.qty));
    if (l.productId) {
      const p = t.products.find((x) => x.id === l.productId);
      if (!p) continue;
      const totals = lineTotals(p.price, qty, p.tiers);
      lines.push({
        key: `p:${p.id}`,
        kind: "product",
        id: p.id,
        name: p.name,
        image: p.image,
        qty,
        unit: p.price,
        ...totals,
        ...(p.preorder ? { preorderArrives: p.preorder.arrives } : {}),
        categories: [p.category],
        stockNeeds: [{ productId: p.id, qty, preorder: !!p.preorder }],
      });
    } else if (l.bundleId) {
      const b = t.bundles.find((x) => x.id === l.bundleId);
      if (!b) continue;
      const items = b.items.map((i) => ({ i, p: t.products.find((x) => x.id === i.productId) }));
      lines.push({
        key: `b:${b.id}`,
        kind: "bundle",
        id: b.id,
        name: b.name,
        image: b.image,
        qty,
        unit: b.price,
        full: b.price * qty,
        total: b.price * qty,
        discount: 0,
        categories: [...new Set(items.flatMap(({ p }) => (p ? [p.category] : [])))],
        stockNeeds: items.flatMap(({ i, p }) =>
          p ? [{ productId: p.id, qty: i.qty * qty, preorder: !!p.preorder }] : [],
        ),
      });
    }
  }

  const subtotal = lines.reduce((s, l) => s + l.full, 0);
  const bulkDiscount = lines.reduce((s, l) => s + l.discount, 0);
  const afterBulk = subtotal - bulkDiscount;

  const problems: string[] = [];
  let code: PricedCart["code"];
  let codeError: string | undefined;
  if (input.code?.trim()) {
    const c = t.codes.find((x) => x.code.toUpperCase() === input.code!.trim().toUpperCase());
    if (!c || !c.active) codeError = "That code isn't valid or has expired.";
    else code = { code: c.code, pct: c.pct, amount: Math.round((afterBulk * c.pct) / 100) };
  }

  let delivery: PricedCart["delivery"];
  const zone = t.zones.find((z) => z.state === input.state);
  const city = zone?.cities.find((c) => c.name === input.city);
  if (city) {
    const eta = new Date(now);
    eta.setDate(eta.getDate() + city.days);
    delivery = { fee: city.fee, days: city.days, eta: eta.toISOString().slice(0, 10) };
  }

  const blockedCats = (input.state && t.blocks[input.state]) || [];
  const blocked = lines.flatMap((l) =>
    l.categories
      .filter((c) => blockedCats.includes(c))
      .map((category) => ({ name: l.name, category })),
  );

  const need = new Map<string, number>();
  for (const l of lines)
    for (const n of l.stockNeeds)
      if (!n.preorder) need.set(n.productId, (need.get(n.productId) ?? 0) + n.qty);
  const outOfStock = [...need].flatMap(([id, requested]) => {
    const p = t.products.find((x) => x.id === id);
    const available = p ? p.stock - (p.reserved ?? 0) : 0;
    return p && available < requested ? [{ name: p.name, available, requested }] : [];
  });

  if (!lines.length) problems.push("Your cart is empty.");
  if (!input.state || !input.city) problems.push("Choose your delivery state and city.");
  else if (!delivery) problems.push("We don't deliver to that city yet.");
  if (blocked.length) problems.push(`Some items can't be delivered to ${input.state} right now.`);
  if (outOfStock.length) problems.push("Some items don't have enough stock.");

  const total = afterBulk - (code?.amount ?? 0) + (delivery?.fee ?? 0);
  return {
    lines,
    subtotal,
    bulkDiscount,
    total,
    blocked,
    outOfStock,
    problems,
    ...(code ? { code } : {}),
    ...(codeError ? { codeError } : {}),
    ...(delivery ? { delivery } : {}),
  };
}
