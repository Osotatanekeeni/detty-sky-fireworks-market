import type { PriceTier } from "./types";

export const DEFAULT_TIERS: PriceTier[] = [
  { minQty: 10, discountPct: 5 },
  { minQty: 25, discountPct: 10 },
];

export function formatNaira(n: number) {
  return "₦" + Math.round(n).toLocaleString("en-NG");
}

export function tierFor(qty: number, tiers: PriceTier[] = DEFAULT_TIERS): PriceTier | null {
  return [...tiers].sort((a, b) => b.minQty - a.minQty).find((t) => qty >= t.minQty) ?? null;
}

export function unitPriceFor(price: number, qty: number, tiers: PriceTier[] = DEFAULT_TIERS) {
  const t = tierFor(qty, tiers);
  return t ? Math.round(price * (1 - t.discountPct / 100)) : price;
}

export function lineTotals(price: number, qty: number, tiers: PriceTier[] = DEFAULT_TIERS) {
  const full = price * qty;
  const total = unitPriceFor(price, qty, tiers) * qty;
  return { full, total, discount: full - total };
}
