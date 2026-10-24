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
import { fetchCatalogue } from "./catalogue.server";
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

export const getCatalogue = createServerFn({ method: "GET" }).handler((): Promise<Catalogue> =>
  fetchCatalogue(supabasePublic()),
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
