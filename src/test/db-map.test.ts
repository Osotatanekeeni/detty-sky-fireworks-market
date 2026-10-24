import { describe, expect, it } from "vitest";
import { priceCart } from "@/lib/checkout";
import {
  BUNDLES,
  CATEGORY_STATE_BLOCKS,
  DELIVERY_ZONES,
  DISCOUNT_CODES,
  PRODUCTS,
} from "@/lib/data";
import {
  blocksFromRows,
  formatArrives,
  productFromRow,
  productMediaRows,
  productToRow,
  toKobo,
  toNaira,
  zonesFromRows,
  type ProductRow,
} from "@/lib/db-map";

const row: ProductRow = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "royal-crown-100",
  name: "Royal Crown 100",
  category_slug: "aerial-cakes",
  description: "Big.",
  price_kobo: 8_500_000,
  compare_at_kobo: 9_800_000,
  duration_sec: 60,
  shots: 100,
  height_m: "40.0",
  noise: "Loud",
  colours: ["Gold"],
  stock: 18,
  reserved: 3,
  low_stock_threshold: 10,
  preorder_arrives: "2026-12-20",
  best_seller: true,
  product_occasions: [{ occasion_slug: "new-year" }],
  product_media: [
    { kind: "image", url: "/b.jpg", sort: 1 },
    { kind: "poster", url: "/poster.jpg", sort: 0 },
    { kind: "image", url: "/a.jpg", sort: 0 },
  ],
  price_tiers: [
    { min_qty: 25, discount_pct: 10 },
    { min_qty: 10, discount_pct: 5 },
  ],
};

describe("db-map", () => {
  it("converts kobo ↔ naira exactly", () => {
    expect(toKobo(85000)).toBe(8_500_000);
    expect(toNaira(8_500_000)).toBe(85000);
    expect(toNaira("250000")).toBe(2500); // bigint can arrive as a string
    expect(toKobo(0.1 + 0.2)).toBe(30); // no float drift
  });

  it("maps a product row to the UI type", () => {
    const p = productFromRow(row);
    expect(p.price).toBe(85000);
    expect(p.compareAt).toBe(98000);
    expect(p.heightM).toBe(40);
    expect(p.image).toBe("/a.jpg");
    expect(p.gallery).toEqual(["/a.jpg", "/b.jpg"]);
    expect(p.videoPoster).toBe("/poster.jpg");
    expect(p.tiers).toEqual([
      { minQty: 10, discountPct: 5 },
      { minQty: 25, discountPct: 10 },
    ]);
    expect(p.preorder).toEqual({ arrives: "2026-12-20" });
    expect(p.reserved).toBe(3);
  });

  it("round-trips a product through productToRow / productMediaRows", () => {
    const p = productFromRow(row);
    const back = productToRow(p);
    expect(back.price_kobo).toBe(row.price_kobo);
    expect(back.compare_at_kobo).toBe(row.compare_at_kobo);
    expect(back.preorder_arrives).toBe("2026-12-20");
    const media = productMediaRows(p);
    expect(media.map((m) => [m.kind, m.url])).toEqual([
      ["image", "/a.jpg"],
      ["image", "/b.jpg"],
      ["poster", "/poster.jpg"],
    ]);
    expect(productFromRow({ ...row, product_media: media }).videoPoster).toBe("/poster.jpg");
  });

  it("drops a compare-at price that isn't above the price (DB check constraint)", () => {
    const p = { ...productFromRow(row), compareAt: 85000 };
    expect(productToRow(p).compare_at_kobo).toBeNull();
  });

  it("groups cities into all six states and blocks by state", () => {
    const zones = zonesFromRows([
      { state: "Rivers", name: "Port Harcourt", fee_kobo: 250000, days: 1 },
    ]);
    expect(zones).toHaveLength(6);
    expect(zones.find((z) => z.state === "Rivers")!.cities).toEqual([
      { name: "Port Harcourt", fee: 2500, days: 1 },
    ]);
    expect(blocksFromRows([{ state: "Bayelsa", category_slug: "rockets" }])).toEqual({
      Bayelsa: ["rockets"],
    });
  });

  it("formats pre-order dates and leaves legacy strings alone", () => {
    expect(formatArrives("2026-12-20")).toMatch(/Dec/);
    expect(formatArrives("Dec 20")).toBe("Dec 20");
  });
});

describe("priceCart with reservations", () => {
  it("treats reserved units as unavailable", () => {
    const p = PRODUCTS.find((x) => !x.preorder && x.stock === 9)!; // Silver Waterfall Fountain
    const tables = {
      products: PRODUCTS.map((x) => (x.id === p.id ? { ...x, reserved: 5 } : x)),
      bundles: BUNDLES,
      zones: DELIVERY_ZONES,
      blocks: CATEGORY_STATE_BLOCKS,
      codes: DISCOUNT_CODES,
    };
    const r = priceCart(tables, {
      lines: [{ productId: p.id, qty: 5 }],
      state: "Rivers",
      city: "Port Harcourt",
    });
    expect(r.outOfStock).toEqual([{ name: p.name, available: 4, requested: 5 }]);
  });
});
