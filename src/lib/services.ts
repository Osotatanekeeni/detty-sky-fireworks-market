// Read helpers: pure functions over the Supabase-loaded catalogue (components get it from
// useCatalogue()). Orders are read through server functions in orders.functions.ts.
import type { Catalogue } from "./catalogue";
import { CATEGORIES, OCCASIONS } from "./data";
import type { Bundle, CategorySlug, NoiseLevel, OccasionSlug, Product, StateName } from "./types";

type Cat<K extends keyof Catalogue> = Pick<Catalogue, K>;

export interface ProductFilters {
  q?: string | undefined;
  category?: CategorySlug | undefined;
  occasion?: OccasionSlug | undefined;
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
  noise?: NoiseLevel | undefined;
  maxDuration?: number | undefined;
  minShots?: number | undefined;
  sort?: "featured" | "price-asc" | "price-desc" | "rating" | "shots" | undefined;
}

export function ratingFor(c: Cat<"reviews">, productId: string) {
  const rs = c.reviews.filter((r) => r.productId === productId && r.status === "approved");
  const avg = rs.length ? rs.reduce((s, r) => s + r.rating, 0) / rs.length : 0;
  const breakdown = [5, 4, 3, 2, 1].map((star) => ({ star, count: rs.filter((r) => r.rating === star).length }));
  return { avg, count: rs.length, breakdown };
}

export function listProducts(c: Cat<"products" | "reviews">, f: ProductFilters = {}): Product[] {
  let list = c.products.filter((p) => {
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
    case "rating": list = [...list].sort((a, b) => ratingFor(c, b.id).avg - ratingFor(c, a.id).avg); break;
    case "shots": list = [...list].sort((a, b) => b.shots - a.shots); break;
    default: list = [...list].sort((a, b) => Number(!!b.bestSeller) - Number(!!a.bestSeller));
  }
  return list;
}

export const getProduct = (c: Cat<"products">, slug: string) => c.products.find((p) => p.slug === slug);
export const getProductById = (c: Cat<"products">, id: string) => c.products.find((p) => p.id === id);
export const getReviews = (c: Cat<"reviews">, productId: string) =>
  c.reviews.filter((r) => r.productId === productId && r.status === "approved");
export const relatedProducts = (c: Cat<"products">, p: Product) =>
  c.products.filter((x) => x.id !== p.id && (x.category === p.category || x.occasions.some((o) => p.occasions.includes(o)))).slice(0, 4);
export const bestSellers = (c: Cat<"products">) => c.products.filter((p) => p.bestSeller);
export const getBundle = (c: Cat<"bundles">, id: string) => c.bundles.find((b) => b.id === id);
export const bundleValue = (c: Cat<"products">, b: Bundle) =>
  b.items.reduce((s, i) => s + (getProductById(c, i.productId)?.price ?? 0) * i.qty, 0);
export const getCategory = (slug: string) => CATEGORIES.find((c) => c.slug === slug);
export const getOccasion = (slug: string) => OCCASIONS.find((o) => o.slug === slug);
export function deliveryQuote(c: Cat<"zones">, state?: StateName, city?: string) {
  const zone = c.zones.find((z) => z.state === state);
  const found = zone?.cities.find((x) => x.name === city);
  if (!found) return null;
  const eta = new Date();
  eta.setDate(eta.getDate() + found.days);
  return { fee: found.fee, days: found.days, eta };
}

export const isCategoryBlocked = (c: Cat<"blocks">, state: StateName | undefined, cat: CategorySlug) =>
  !!state && !!c.blocks[state]?.includes(cat);

export function nextNewYearEve() {
  // Midnight WAT (UTC+1) at the start of Jan 1 => Dec 31 23:00 UTC
  const now = new Date();
  let target = Date.UTC(now.getUTCFullYear(), 11, 31, 23, 0, 0);
  if (now.getTime() > target) target = Date.UTC(now.getUTCFullYear() + 1, 11, 31, 23, 0, 0);
  return target;
}
