import { describe, expect, it } from "vitest";
import { priceCart } from "@/lib/checkout";
import {
  BUNDLES,
  CATEGORY_STATE_BLOCKS,
  DELIVERY_ZONES,
  DISCOUNT_CODES,
  PRODUCTS,
} from "@/lib/data";

const tables = {
  products: PRODUCTS,
  bundles: BUNDLES,
  zones: DELIVERY_ZONES,
  blocks: CATEGORY_STATE_BLOCKS,
  codes: DISCOUNT_CODES,
};
const byName = (n: string) => PRODUCTS.find((p) => p.name === n)!;
const NOW = new Date("2026-12-01T09:00:00+01:00");

describe("priceCart", () => {
  it("applies bulk tiers, code discount and delivery fee in the right order", () => {
    const cake = byName("Crossover King 49"); // ₦42,000, in stock
    const r = priceCart(
      tables,
      {
        lines: [{ productId: cake.id, qty: 12 }],
        state: "Rivers",
        city: "Port Harcourt",
        code: "DETTY10",
      },
      NOW,
    );
    expect(r.subtotal).toBe(42000 * 12);
    expect(r.bulkDiscount).toBe(42000 * 12 * 0.05); // 10+ units → 5%
    const afterBulk = r.subtotal - r.bulkDiscount;
    expect(r.code?.amount).toBe(Math.round(afterBulk * 0.1)); // code applies after bulk
    expect(r.delivery).toEqual({ fee: 2500, days: 1, eta: "2026-12-02" });
    expect(r.total).toBe(afterBulk - r.code!.amount + 2500);
    expect(r.problems).toEqual([]);
  });

  it("blocks categories disabled for the delivery state, including inside bundles", () => {
    const rockets = byName("Sky Blast Rockets (5)");
    const countdownPack = BUNDLES.find((b) => b.slug === "new-year-countdown-pack")!; // contains rockets
    const r = priceCart(tables, {
      lines: [
        { productId: rockets.id, qty: 1 },
        { bundleId: countdownPack.id, qty: 1 },
      ],
      state: "Bayelsa",
      city: "Yenagoa",
    });
    expect(r.blocked.map((b) => b.name)).toEqual([rockets.name, countdownPack.name]);
    expect(r.problems.join(" ")).toMatch(/Bayelsa/);
  });

  it("flags insufficient stock but ignores stock for pre-order items", () => {
    const low = byName("Delta Comet Rockets (12)"); // stock 4
    const pre = byName("Royal Crown 100"); // pre-order, stock 18
    const r = priceCart(tables, {
      lines: [
        { productId: low.id, qty: 5 },
        { productId: pre.id, qty: 50 },
      ],
      state: "Rivers",
      city: "Port Harcourt",
    });
    expect(r.outOfStock).toEqual([{ name: low.name, available: 4, requested: 5 }]);
  });

  it("rejects unknown or inactive codes without changing the total", () => {
    const p = byName("Gold Sparklers 36cm (10)");
    const base = priceCart(tables, {
      lines: [{ productId: p.id, qty: 2 }],
      state: "Edo",
      city: "Benin City",
    });
    const bad = priceCart(tables, {
      lines: [{ productId: p.id, qty: 2 }],
      state: "Edo",
      city: "Benin City",
      code: "XMAS2025",
    });
    expect(bad.codeError).toBeTruthy();
    expect(bad.total).toBe(base.total);
  });

  it("requires a city we deliver to", () => {
    const p = byName("Gold Sparklers 36cm (10)");
    expect(priceCart(tables, { lines: [{ productId: p.id, qty: 1 }] }).problems).toContain(
      "Choose your delivery state and city.",
    );
    expect(
      priceCart(tables, { lines: [{ productId: p.id, qty: 1 }], state: "Edo", city: "Lagos" })
        .problems,
    ).toContain("We don't deliver to that city yet.");
  });

  it("ignores client-supplied junk quantities and unknown products", () => {
    const p = byName("Gold Sparklers 36cm (10)");
    const r = priceCart(tables, {
      lines: [
        { productId: p.id, qty: -3 },
        { productId: "nope", qty: 1 },
      ],
      state: "Rivers",
      city: "Port Harcourt",
    });
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0]!.qty).toBe(1);
  });
});
