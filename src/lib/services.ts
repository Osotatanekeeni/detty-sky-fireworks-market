// Mock data services. Swap these implementations for real API/database calls later;
// components only depend on these function signatures.
import { BUNDLES, CATEGORIES, CATEGORY_STATE_BLOCKS, DELIVERY_ZONES, OCCASIONS, ORDERS, PRODUCTS, REVIEWS } from "./data";
import type { CategorySlug, NoiseLevel, OccasionSlug, Product, StateName } from "./types";

export interface ProductFilters {
  q?: string;
  category?: CategorySlug;
  occasion?: OccasionSlug;
  minPrice?: number;
  maxPrice?: number;
  noise?: NoiseLevel;
  maxDuration?: number;
  minShots?: number;
  sort?: "featured" | "price-asc" | "price-desc" | "rating" | "shots";
}

export function ratingFor(productId: string) {
  const rs = REVIEWS.filter((r) => r.productId === productId && r.status === "approved");
  const avg = rs.length ? rs.reduce((s, r) => s + r.rating, 0) / rs.length : 0;
  const breakdown = [5, 4, 3, 2, 1].map((star) => ({ star, count: rs.filter((r) => r.rating === star).length }));
  return { avg, count: rs.length, breakdown };
}

export function listProducts(f: ProductFilters = {}): Product[] {
  let list = PRODUCTS.filter((p) => {
    if (f.q && !`${p.name} ${p.category} ${p.colours.join(" ")}`.toLowerCase().includes(f.q.toLowerCase())) return false;
    if (f.category && p.category !== f.category) return false;
    if (f.occasion && !p.occasions.includes(f.occasion)) return false;
    if (f.minPrice != null && p.price < f.minPrice) return false;
    if (f.maxPrice != null && p.price > f.maxPrice) return false;
    if (f.noise && p.noise !== f.noise) return false;
    if (f.maxDuration != null && p.durationSec > f.maxDuration) return false;
    if (f.minShots != null && p.shots < f.minShots) return false;
    return true;
  });
  switch (f.sort) {
    case "price-asc": list = [...list].sort((a, b) => a.price - b.price); break;
    case "price-desc": list = [...list].sort((a, b) => b.price - a.price); break;
    case "rating": list = [...list].sort((a, b) => ratingFor(b.id).avg - ratingFor(a.id).avg); break;
    case "shots": list = [...list].sort((a, b) => b.shots - a.shots); break;
    default: list = [...list].sort((a, b) => Number(!!b.bestSeller) - Number(!!a.bestSeller));
  }
  return list;
}

export const getProduct = (slug: string) => PRODUCTS.find((p) => p.slug === slug);
export const getProductById = (id: string) => PRODUCTS.find((p) => p.id === id);
export const getReviews = (productId: string) => REVIEWS.filter((r) => r.productId === productId && r.status === "approved");
export const relatedProducts = (p: Product) => PRODUCTS.filter((x) => x.id !== p.id && (x.category === p.category || x.occasions.some((o) => p.occasions.includes(o)))).slice(0, 4);
export const bestSellers = () => PRODUCTS.filter((p) => p.bestSeller);
export const listBundles = () => BUNDLES;
export const bundleValue = (b: (typeof BUNDLES)[number]) => b.items.reduce((s, i) => s + (getProductById(i.productId)?.price ?? 0) * i.qty, 0);
export const getCategory = (slug: string) => CATEGORIES.find((c) => c.slug === slug);
export const getOccasion = (slug: string) => OCCASIONS.find((o) => o.slug === slug);
export const getOrder = (id: string) => ORDERS.find((o) => o.id === id);

export function deliveryQuote(state?: StateName, city?: string) {
  const zone = DELIVERY_ZONES.find((z) => z.state === state);
  const c = zone?.cities.find((x) => x.name === city);
  if (!c) return null;
  const eta = new Date();
  eta.setDate(eta.getDate() + c.days);
  return { fee: c.fee, days: c.days, eta };
}

export const isCategoryBlocked = (state: StateName | undefined, cat: CategorySlug) =>
  !!state && !!CATEGORY_STATE_BLOCKS[state]?.includes(cat);

export function nextNewYearEve() {
  // Midnight WAT (UTC+1) at the start of Jan 1 => Dec 31 23:00 UTC
  const now = new Date();
  let target = Date.UTC(now.getUTCFullYear(), 11, 31, 23, 0, 0);
  if (now.getTime() > target) target = Date.UTC(now.getUTCFullYear() + 1, 11, 31, 23, 0, 0);
  return target;
}
