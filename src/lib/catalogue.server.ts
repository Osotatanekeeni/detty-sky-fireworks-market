// Server-side catalogue loading, shared by the storefront (getCatalogue) and checkout pricing.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Catalogue } from "./catalogue";
import {
  BUNDLE_SELECT,
  PRODUCT_SELECT,
  REVIEW_SELECT,
  bannerFromRow,
  blocksFromRows,
  bundleFromRow,
  campaignFromRow,
  productFromRow,
  reviewFromRow,
  zonesFromRows,
  type BannerRow,
  type BlockRow,
  type BundleRow,
  type CampaignRow,
  type CityRow,
  type ProductRow,
  type ReviewRow,
} from "./db-map";

function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`Couldn't load ${what}: ${res.error.message}`);
  return res.data as T;
}

/** Loads the public catalogue. Storefront: supabasePublic(). Checkout pricing: supabaseService()
 *  (same rows — the catalogue is public — but fresh and RLS-free). */
export async function fetchCatalogue(db: SupabaseClient): Promise<Catalogue> {
  {
    const [products, bundles, reviews, cities, blocks, banners, campaign] = await Promise.all([
      db.from("products").select(PRODUCT_SELECT).eq("is_active", true).order("created_at"),
      db.from("bundles").select(BUNDLE_SELECT).eq("is_active", true).order("created_at"),
      db
        .from("reviews")
        .select(REVIEW_SELECT)
        .eq("status", "approved")
        .order("created_at", { ascending: false }),
      db
        .from("delivery_cities")
        .select("state, name, fee_kobo, days")
        .eq("is_active", true)
        .order("fee_kobo")
        .order("name"),
      db.from("category_state_blocks").select("category_slug, state"),
      db
        .from("banners")
        .select("id, title, subtitle, cta, href, tone, active, sort")
        .eq("active", true)
        .order("sort"),
      db
        .from("campaign_settings")
        .select("announcement, preorders_open, countdown_label")
        .eq("id", 1)
        .single(),
    ]);
    return {
      products: must(products, "products").map((r) => productFromRow(r as unknown as ProductRow)),
      bundles: must(bundles, "bundles").map((r) => bundleFromRow(r as unknown as BundleRow)),
      reviews: must(reviews, "reviews").map((r) => reviewFromRow(r as unknown as ReviewRow)),
      zones: zonesFromRows(must(cities, "delivery cities") as CityRow[]),
      blocks: blocksFromRows(must(blocks, "state blocks") as BlockRow[]),
      banners: (must(banners, "banners") as BannerRow[]).map(bannerFromRow),
      campaign: campaignFromRow(must(campaign, "campaign") as CampaignRow),
    };
  }
}

// Per-isolate cache for the public catalogue. Every SSR page needs it, so without this each
// page view would cost 7 Supabase queries. 15 s keeps admin edits near-instant (the admin's own
// refresh bypasses it) while absorbing the New Year's Eve spike. Checkout never uses it — it
// prices from fresh rows.
const TTL_MS = 15_000;
let cached: { at: number; value: Promise<Catalogue> } | undefined;

export function cachedCatalogue(db: SupabaseClient, fresh = false): Promise<Catalogue> {
  if (!fresh && cached && Date.now() - cached.at < TTL_MS) return cached.value;
  const value = fetchCatalogue(db);
  cached = { at: Date.now(), value };
  value.catch(() => {
    if (cached?.value === value) cached = undefined; // don't cache failures
  });
  return value;
}
