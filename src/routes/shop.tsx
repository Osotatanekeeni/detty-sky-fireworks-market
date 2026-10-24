import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SearchX, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";
import { ProductGrid } from "@/components/site/ProductCard";
import { Button } from "@/components/ui/button";
import { CATEGORIES, OCCASIONS } from "@/lib/data";
import { OCCASION_ICONS } from "@/components/site/occasion-icons";
import { useCatalogue } from "@/lib/catalogue";
import { listProducts, type ProductFilters } from "@/lib/services";
import type { CategorySlug, NoiseLevel, OccasionSlug } from "@/lib/types";

type Search = {
  q?: string | undefined; category?: CategorySlug | undefined; occasion?: OccasionSlug | undefined; noise?: NoiseLevel | undefined;
  maxPrice?: number | undefined; maxDuration?: number | undefined; minShots?: number | undefined; sort?: ProductFilters["sort"]; preorder?: boolean | undefined;
};

export const Route = createFileRoute("/shop")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: typeof s["q"] === "string" && s["q"] ? s["q"] : undefined,
    category: CATEGORIES.some((c) => c.slug === s["category"]) ? (s["category"] as CategorySlug) : undefined,
    occasion: OCCASIONS.some((o) => o.slug === s["occasion"]) ? (s["occasion"] as OccasionSlug) : undefined,
    noise: ["Quiet", "Medium", "Loud"].includes(s["noise"] as string) ? (s["noise"] as NoiseLevel) : undefined,
    maxPrice: Number(s["maxPrice"]) || undefined,
    maxDuration: Number(s["maxDuration"]) || undefined,
    minShots: Number(s["minShots"]) || undefined,
    sort: (s["sort"] as Search["sort"]) || undefined,
    preorder: s["preorder"] === true || s["preorder"] === "true" ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Shop Fireworks — Detty Sky" },
      { name: "description", content: "Filter fireworks by category, occasion, price, noise level, duration and shot count." },
      { property: "og:title", content: "Shop Fireworks — Detty Sky" },
      { property: "og:description", content: "Aerial cakes, rockets, fountains, sparklers, smoke and confetti." },
    ],
  }),
  component: Shop,
});

const chip = (active: boolean) => `rounded-full border px-3 py-1.5 text-xs transition-colors ${active ? "border-gold bg-gold/15 text-gold" : "border-border hover:border-gold/50"}`;

function Shop() {
  const s = Route.useSearch();
  const nav = useNavigate({ from: "/shop" });
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<Search>) => nav({ search: (prev) => ({ ...prev, ...patch }), replace: true });
  let products = listProducts(useCatalogue(), s);
  if (s.preorder) products = products.filter((p) => p.preorder);
  const title = s.category ? CATEGORIES.find((c) => c.slug === s.category)?.name : s.occasion ? OCCASIONS.find((o) => o.slug === s.occasion)?.name : s.preorder ? "December pre-orders" : s.q ? `Results for “${s.q}”` : "All fireworks";

  const filters = (
    <div className="space-y-6">
      <Group label="Category">
        {CATEGORIES.map((c) => <button key={c.slug} className={chip(s.category === c.slug)} onClick={() => set({ category: s.category === c.slug ? undefined : c.slug })}>{c.name}</button>)}
      </Group>
      <Group label="Occasion">
        {OCCASIONS.map((o) => <button key={o.slug} className={chip(s.occasion === o.slug)} onClick={() => set({ occasion: s.occasion === o.slug ? undefined : o.slug })}><span className="inline-flex items-center gap-1.5">{(() => { const Icon = OCCASION_ICONS[o.slug]; return <Icon className="h-3.5 w-3.5" aria-hidden />; })()} {o.name}</span></button>)}
      </Group>
      <Group label="Max price">
        {[5000, 15000, 50000, 100000].map((v) => <button key={v} className={chip(s.maxPrice === v)} onClick={() => set({ maxPrice: s.maxPrice === v ? undefined : v })}>Under ₦{v.toLocaleString()}</button>)}
      </Group>
      <Group label="Noise level">
        {(["Quiet", "Medium", "Loud"] as const).map((n) => <button key={n} className={chip(s.noise === n)} onClick={() => set({ noise: s.noise === n ? undefined : n })}>{n}</button>)}
      </Group>
      <Group label="Duration">
        {[10, 30, 60].map((v) => <button key={v} className={chip(s.maxDuration === v)} onClick={() => set({ maxDuration: s.maxDuration === v ? undefined : v })}>≤ {v}s</button>)}
      </Group>
      <Group label="Shot count">
        {[10, 25, 50, 100].map((v) => <button key={v} className={chip(s.minShots === v)} onClick={() => set({ minShots: s.minShots === v ? undefined : v })}>{v}+ shots</button>)}
      </Group>
      <Group label="Availability">
        <button className={chip(!!s.preorder)} onClick={() => set({ preorder: s.preorder ? undefined : true })}>Pre-order only</button>
      </Group>
      <Button variant="ghost" size="sm" onClick={() => nav({ search: {} })}>Clear all filters</Button>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-magenta">Shop</p>
          <h1 className="text-3xl sm:text-4xl">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{products.length} products</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="glass" className="lg:hidden" onClick={() => setOpen(true)}><SlidersHorizontal /> Filters</Button>
          <label className="sr-only" htmlFor="sort">Sort</label>
          <select id="sort" value={s.sort ?? "featured"} onChange={(e) => set({ sort: e.target.value as Search["sort"] })}
            className="glass h-9 rounded-full px-4 text-sm">
            <option value="featured">Featured</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="rating">Top rated</option>
            <option value="shots">Most shots</option>
          </select>
        </div>
      </div>
      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block">{filters}</aside>
        <div>
          {products.length ? <ProductGrid products={products} /> : (
            <div className="glass rounded-3xl p-12 text-center">
              <SearchX className="mx-auto h-10 w-10 text-gold" aria-hidden />
              <h2 className="mt-3 text-xl">No fireworks match those filters</h2>
              <p className="mt-1 text-sm text-muted-foreground">Try removing a filter or two.</p>
              <Button asChild variant="gold" className="mt-5"><Link to="/shop">Show everything</Link></Button>
            </div>
          )}
        </div>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background p-6 lg:hidden" role="dialog" aria-label="Filters">
          <div className="mb-6 flex items-center justify-between"><h2 className="text-xl">Filters</h2><button onClick={() => setOpen(false)} aria-label="Close filters"><X /></button></div>
          {filters}
          <Button variant="gold" size="lg" className="mt-8 w-full" onClick={() => setOpen(false)}>Show {products.length} products</Button>
        </div>
      )}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}
