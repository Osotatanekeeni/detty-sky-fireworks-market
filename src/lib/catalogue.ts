// The public catalogue: everything the storefront reads that is the same for every visitor
// (products, bundles, approved reviews, delivery zones, kill-switch blocks, banners, campaign).
//
// Loaded once per request in the root route loader via TanStack Query, dehydrated into the
// HTML (see router.tsx) and cached in the browser. Components read it with useCatalogue().
// After an admin write, call the function from useRefreshCatalogue() so every page sees it.
import {
  queryOptions,
  useQueryClient,
  useSuspenseQuery,
  type QueryClient,
} from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { useRouter } from "@tanstack/react-router";
import { useCallback } from "react";
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
import { supabasePublic } from "./supabase.server";
import type {
  Banner,
  Bundle,
  Campaign,
  CategorySlug,
  DeliveryZone,
  Product,
  Review,
  StateName,
} from "./types";

export interface Catalogue {
  products: Product[];
  bundles: Bundle[];
  /** Approved reviews only. */
  reviews: Review[];
  zones: DeliveryZone[];
  blocks: Partial<Record<StateName, CategorySlug[]>>;
  /** Active banners only. */
  banners: Banner[];
  campaign: Campaign;
}

function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`Couldn't load ${what}: ${res.error.message}`);
  return res.data as T;
}

export const getCatalogue = createServerFn({ method: "GET" }).handler(
  async (): Promise<Catalogue> => {
    const db = supabasePublic();
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
  },
);

export const catalogueQuery = queryOptions({
  queryKey: ["catalogue"],
  queryFn: () => getCatalogue(),
  staleTime: 60_000,
});

export const loadCatalogue = (qc: QueryClient) => qc.ensureQueryData(catalogueQuery);

export function useCatalogue(): Catalogue {
  return useSuspenseQuery(catalogueQuery).data;
}

/** Refetch the catalogue and re-run route loaders (call after admin writes). */
export function useRefreshCatalogue() {
  const qc = useQueryClient();
  const router = useRouter();
  return useCallback(async () => {
    await qc.invalidateQueries({ queryKey: catalogueQuery.queryKey });
    await router.invalidate();
  }, [qc, router]);
}
