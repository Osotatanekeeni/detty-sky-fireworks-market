import { createFileRoute, Link } from "@tanstack/react-router";
import { Play, Truck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Countdown } from "@/components/site/Countdown";
import { Fireworks } from "@/components/site/Fireworks";
import { ProductGrid, SectionTitle, Stars } from "@/components/site/ProductCard";
import { CATEGORIES, OCCASIONS } from "@/lib/data";
import { OCCASION_ICONS } from "@/components/site/occasion-icons";
import { formatNaira } from "@/lib/pricing";
import { useCatalogue } from "@/lib/catalogue";
import { bestSellers, bundleValue } from "@/lib/services";
import type { Banner } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Detty Sky — Fireworks Delivered Across the South-South" },
      { name: "description", content: "Shop aerial cakes, rockets, sparklers and party effects. Delivery to Rivers, Akwa Ibom, Bayelsa, Cross River, Delta & Edo." },
      { property: "og:title", content: "Detty Sky — Make Your December Detty" },
      { property: "og:description", content: "Premium fireworks for Christmas, crossover, weddings and birthdays." },
    ],
  }),
  component: Home,
});

const BANNER_TONE: Record<Banner["tone"], string> = {
  gold: "bg-gold-gradient text-primary-foreground",
  party: "bg-party-gradient text-primary-foreground",
  royal: "bg-gradient-to-br from-royal to-night text-foreground border border-royal/50",
};

function Banners() {
  const { banners } = useCatalogue();
  const active = banners.filter((b) => b.active);
  if (!active.length) return null;
  return (
    <section aria-label="Promotions" className="flex snap-x gap-3 overflow-x-auto pb-2">
      {active.map((b) => (
        <a key={b.id} href={b.href} className={`group relative flex min-w-[85%] snap-start flex-col justify-between gap-4 overflow-hidden rounded-3xl p-6 sm:min-w-[48%] ${BANNER_TONE[b.tone]}`}>
          <div>
            <h2 className="text-xl sm:text-2xl">{b.title}</h2>
            <p className="mt-1 max-w-md text-sm opacity-80">{b.subtitle}</p>
          </div>
          <span className="w-fit rounded-full bg-night/80 px-4 py-2 text-sm font-semibold text-foreground transition-transform group-hover:translate-x-1">{b.cta} →</span>
        </a>
      ))}
    </section>
  );
}

function Home() {
  const cat = useCatalogue();
  const { campaign } = cat;
  const catImg = (slug: string) => cat.products.find((p) => p.category === slug)?.image;
  const videoReviews = cat.reviews.filter((r) => r.media?.[0]?.type === "video" && cat.products.some((p) => p.id === r.productId)).slice(0, 6);
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0"><Fireworks intensity={1.2} /></div>
        <div className="relative mx-auto flex min-h-[78vh] max-w-7xl flex-col items-center justify-center px-4 py-20 text-center">
          <p className="animate-float-up mb-4 rounded-full border border-gold/40 px-4 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-gold">South-South's premium fireworks</p>
          <h1 className="animate-float-up max-w-4xl text-4xl font-extrabold leading-[1.05] sm:text-6xl lg:text-7xl">
            Make your December <span className="text-party-gradient">detty.</span>
          </h1>
          <p className="animate-float-up mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            From Christmas Eve to crossover night — light up the sky with fireworks delivered to your door.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild variant="gold" size="lg"><Link to="/shop">Shop Now</Link></Button>
            <Button asChild variant="glass" size="lg"><a href="#occasions">Shop by Occasion</a></Button>
          </div>
          <div className="mt-12 flex flex-col items-center gap-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{campaign.countdownLabel}</p>
            <Countdown />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-20 px-4">
        <Banners />
        <section>
          <SectionTitle eyebrow="Categories" title="Shop by category" action={<Link to="/shop" className="text-sm text-gold">See all →</Link>} />
          <div className="flex snap-x gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-4 lg:grid-cols-7">
            {CATEGORIES.map((c) => (
              <Link key={c.slug} to="/shop" search={{ category: c.slug }} className="group relative w-36 shrink-0 snap-start overflow-hidden rounded-2xl sm:w-auto">
                <img src={catImg(c.slug)} alt="" loading="lazy" className="aspect-[3/4] w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-night via-night/30 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <p className="font-display text-sm">{c.name}</p>
                  <p className="text-[11px] text-muted-foreground">{c.blurb}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section id="occasions" className="scroll-mt-28">
          <SectionTitle eyebrow="Occasions" title="What are we celebrating?" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {OCCASIONS.map((o, i) => (
              <Link key={o.slug} to="/shop" search={{ occasion: o.slug }}
                className="glass group rounded-2xl p-5 transition-all hover:-translate-y-1 hover:border-gold/50">
                {(() => { const Icon = OCCASION_ICONS[o.slug]; return <Icon className={`h-8 w-8 ${["text-gold", "text-magenta", "text-ember", "text-emerald", "text-royal"][i]}`} aria-hidden />; })()}
                <p className="mt-3 font-display text-sm">{o.name}</p>
                <p className={`text-xs ${["text-gold", "text-magenta", "text-ember", "text-emerald", "text-royal"][i]}`}>{o.blurb}</p>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle eyebrow="Save more" title="Featured bundles" action={<Link to="/bundles" className="text-sm text-gold">All bundles →</Link>} />
          <div className="grid gap-4 md:grid-cols-2">
            {cat.bundles.slice(0, 2).map((b) => {
              const value = bundleValue(cat, b);
              return (
                <Link key={b.id} to="/bundles" className="glass group relative flex overflow-hidden rounded-3xl">
                  <img src={b.image} alt={b.name} loading="lazy" className="w-2/5 object-cover" />
                  <div className="flex flex-1 flex-col justify-center gap-2 p-5">
                    <span className="w-fit rounded-full bg-magenta px-2 py-0.5 text-[10px] font-bold uppercase">Save {formatNaira(value - b.price)}</span>
                    <h3 className="text-xl">{b.name}</h3>
                    <p className="text-sm text-muted-foreground">{b.tagline}</p>
                    <p className="font-display text-gold">{formatNaira(b.price)} <span className="text-xs text-muted-foreground line-through">{formatNaira(value)}</span></p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section>
          <SectionTitle eyebrow="Fan favourites" title="Best sellers" />
          <ProductGrid products={bestSellers(cat).slice(0, 8)} />
        </section>

        {videoReviews.length > 0 && <section>
          <SectionTitle eyebrow="Real customers" title="Watch them light up" />
          <div className="flex snap-x gap-3 overflow-x-auto pb-2">
            {videoReviews.map((r) => {
              const p = cat.products.find((x) => x.id === r.productId)!;
              return (
                <Link key={r.id} to="/product/$slug" params={{ slug: p.slug }} className="relative w-44 shrink-0 snap-start overflow-hidden rounded-2xl">
                  {/* Poster only — the clip itself plays on the product page, so the homepage stays light. */}
                  <img src={p.image} alt={`Customer clip of ${p.name}`} loading="lazy" className="aspect-[9/16] w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-night via-transparent" />
                  <Play className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background/50 p-2.5 backdrop-blur" />
                  <div className="absolute inset-x-0 bottom-0 p-3 text-xs">
                    <Stars value={r.rating} size={11} />
                    <p className="mt-1 font-semibold">{r.author} · {r.city}</p>
                    <p className="line-clamp-1 text-muted-foreground">{p.name}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>}

        <section className="relative overflow-hidden rounded-3xl bg-party-gradient p-8 text-primary-foreground sm:p-12">
          <Users className="h-10 w-10" />
          <h2 className="mt-4 max-w-xl text-3xl">Buying for a church, hotel or big December party?</h2>
          <p className="mt-2 max-w-lg font-medium">Bulk pricing from 10 units, custom packs and delivery planning for event planners, clubs and congregations.</p>
          <Button asChild size="lg" className="mt-6 rounded-full bg-night text-foreground hover:bg-night/90"><Link to="/bulk">Request a bulk quote</Link></Button>
        </section>

        <section>
          <SectionTitle eyebrow="Delivery" title="We deliver across the South-South" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {cat.zones.filter((z) => z.cities.length).map((z) => (
              <Link key={z.state} to="/delivery" className="glass rounded-2xl p-4 hover:border-gold/50">
                <Truck className="h-5 w-5 text-gold" />
                <p className="mt-2 font-display text-sm">{z.state}</p>
                <p className="text-xs text-muted-foreground">From {formatNaira(Math.min(...z.cities.map((c) => c.fee)))} · {Math.min(...z.cities.map((c) => c.days))}–{Math.max(...z.cities.map((c) => c.days))} days</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
