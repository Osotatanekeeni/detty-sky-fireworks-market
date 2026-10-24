import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { BadgeCheck, Clock, Heart, Minus, Play, Plus, Rocket, ShieldAlert, Sparkles, Volume2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Fireworks, SparkBurst } from "@/components/site/Fireworks";
import { ProductGrid, SectionTitle, Stars } from "@/components/site/ProductCard";
import { ReviewMediaThumb } from "@/components/site/ReviewMedia";
import { Button } from "@/components/ui/button";
import { formatNaira, lineTotals, tierFor } from "@/lib/pricing";
import { getCategory, getProduct, getReviews, ratingFor, relatedProducts } from "@/lib/services";
import { useStore } from "@/lib/store";
import { DeliverTo } from "@/components/site/Shell";
import { loadCatalogue, useCatalogue } from "@/lib/catalogue";
import { formatArrives } from "@/lib/db-map";
import { isCategoryBlocked } from "@/lib/services";

export const Route = createFileRoute("/product/$slug")({
  loader: async ({ params, context }) => {
    const p = getProduct(await loadCatalogue(context.queryClient), params.slug);
    if (!p) throw notFound();
    return { p };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.p.name} — Detty Sky` },
          { name: "description", content: loaderData.p.description },
          { property: "og:title", content: `${loaderData.p.name} — Detty Sky` },
          { property: "og:description", content: loaderData.p.description },
          { property: "og:type", content: "product" },
        ]
      : [{ title: "Product unavailable — Detty Sky" }, { name: "robots", content: "noindex" }],
  }),
  component: ProductPage,
});

/** The real clip (from R2) is only requested when the shopper taps play — mobile data matters.
 *  Products without a clip fall back to the canvas fireworks. */
function VideoPreview({ poster, name, video }: { poster: string; name: string; video?: string | undefined }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="relative aspect-square overflow-hidden rounded-3xl bg-night">
      <img src={poster} alt={`${name} preview`} className={`h-full w-full object-cover transition-opacity ${playing ? "opacity-25" : ""}`} />
      {playing ? (
        video ? (
          <video src={video} poster={poster} autoPlay muted playsInline loop controls preload="none" className="absolute inset-0 h-full w-full bg-night object-contain" aria-label={`${name} video`} />
        ) : (
          <div className="absolute inset-0"><Fireworks intensity={1.6} /></div>
        )
      ) : (
        <button onClick={() => setPlaying(true)} className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-night/30" aria-label={`Play video preview of ${name}`}>
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gold-gradient text-primary-foreground shadow-glow"><Play className="ml-1 h-7 w-7" /></span>
          <span className="text-xs font-semibold uppercase tracking-widest">Watch it light up</span>
        </button>
      )}
      {playing && <button onClick={() => setPlaying(false)} className="absolute bottom-3 right-3 rounded-full bg-background/70 px-3 py-1 text-xs">Stop</button>}
    </div>
  );
}

function ProductPage() {
  const loaded = Route.useLoaderData().p;
  const cat = useCatalogue();
  // Prefer the live catalogue over loader data so admin edits show without a reload.
  const p = getProduct(cat, loaded.slug) ?? loaded;
  const { add, wishlist, toggleWish, deliveryState } = useStore();
  const { campaign } = cat;
  const [qty, setQty] = useState(1);
  const blocked = isCategoryBlocked(cat, deliveryState ?? undefined, p.category);
  const preorderClosed = !!p.preorder && !campaign.preordersOpen;
  const soldOut = !p.preorder && p.stock <= 0;
  const cannotBuy = blocked || preorderClosed || soldOut;
  const [img, setImg] = useState<number | null>(null);
  const [burst, setBurst] = useState(0);
  const r = ratingFor(cat, p.id);
  const reviews = getReviews(cat, p.id);
  const t = lineTotals(p.price, qty, p.tiers);
  const activeTier = tierFor(qty, p.tiers);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <nav className="mb-6 text-xs text-muted-foreground" aria-label="Breadcrumb">
        <Link to="/shop" className="hover:text-gold">Shop</Link> / <Link to="/shop" search={{ category: p.category }} className="hover:text-gold">{getCategory(p.category)?.name}</Link> / <span className="text-foreground">{p.name}</span>
      </nav>
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="space-y-3">
          {img === null ? <VideoPreview poster={p.videoPoster} name={p.name} video={p.video} /> : (
            <img src={p.gallery[img]} alt={`${p.name} photo ${img + 1}`} className="aspect-square w-full rounded-3xl object-cover" />
          )}
          <div className="flex gap-2">
            <button onClick={() => setImg(null)} className={`relative h-20 w-20 overflow-hidden rounded-xl border-2 ${img === null ? "border-gold" : "border-transparent"}`} aria-label="Show video">
              <img src={p.videoPoster} alt="" className="h-full w-full object-cover opacity-60" /><Play className="absolute inset-0 m-auto h-6 w-6" />
            </button>
            {p.gallery.map((g, i) => (
              <button key={i} onClick={() => setImg(i)} className={`h-20 w-20 overflow-hidden rounded-xl border-2 ${img === i ? "border-gold" : "border-transparent"}`} aria-label={`Show photo ${i + 1}`}>
                <img src={g} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        <div>
          {p.preorder && (
            <div className="mb-4 rounded-2xl border border-royal/60 bg-royal/15 p-3 text-sm">
              <strong className="text-gold">Pre-order — arrives {formatArrives(p.preorder.arrives)}.</strong> Pay now, we deliver before New Year's Eve.
            </div>
          )}
          <p className="text-xs uppercase tracking-[0.2em] text-magenta">{getCategory(p.category)?.name}</p>
          <h1 className="mt-1 text-3xl sm:text-4xl">{p.name}</h1>
          <a href="#reviews" className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><Stars value={r.avg} /> {r.avg.toFixed(1)} · {r.count} reviews</a>
          <div className="mt-4 flex items-baseline gap-3">
            <span className="font-display text-3xl text-gold">{formatNaira(p.price)}</span>
            {p.compareAt && <span className="text-muted-foreground line-through">{formatNaira(p.compareAt)}</span>}
          </div>
          <p className="mt-4 text-muted-foreground">{p.description}</p>

          <div className="mt-5 flex flex-wrap gap-2 text-xs">
            <Spec icon={<Clock />} label={`${p.durationSec}s duration`} />
            {p.shots > 0 && <Spec icon={<Sparkles />} label={`${p.shots} shots`} />}
            {p.heightM > 0 && <Spec icon={<Rocket />} label={`${p.heightM}m height`} />}
            <Spec icon={<Volume2 />} label={`${p.noise}`} />
            {p.colours.map((c) => <span key={c} className="rounded-full bg-secondary px-3 py-1.5">{c}</span>)}
          </div>

          <div className="glass mt-6 rounded-2xl p-4">
            <p className="mb-2 text-sm font-semibold">Bulk pricing</p>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1">Quantity</th><th>Discount</th><th>Unit price</th></tr></thead>
              <tbody>
                {[{ minQty: 1, discountPct: 0 }, ...p.tiers].map((tier, i, arr) => (
                  <tr key={tier.minQty} className={(activeTier?.minQty ?? 1) === tier.minQty ? "text-gold" : ""}>
                    <td className="py-1">{tier.minQty}{arr[i + 1] ? `–${arr[i + 1]!.minQty - 1}` : "+"}</td>
                    <td>{tier.discountPct ? `${tier.discountPct}% off` : "—"}</td>
                    <td>{formatNaira(p.price * (1 - tier.discountPct / 100))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="glass flex items-center rounded-full">
              <button className="p-3" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity"><Minus className="h-4 w-4" /></button>
              <input value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} className="w-12 bg-transparent text-center font-semibold outline-none" aria-label="Quantity" inputMode="numeric" />
              <button className="p-3" onClick={() => setQty((q) => q + 1)} aria-label="Increase quantity"><Plus className="h-4 w-4" /></button>
            </div>
            <Button variant="gold" size="lg" className="relative flex-1" disabled={cannotBuy} onClick={() => { add({ productId: p.id, qty }); setBurst((b) => b + 1); toast.success(`${qty} × ${p.name} added to cart`); }}>
              {blocked ? `Unavailable in ${deliveryState}` : preorderClosed ? "Pre-orders closed" : soldOut ? "Sold out" : <>{p.preorder ? "Pre-order" : "Add to cart"} · {formatNaira(t.total)}</>}
              <SparkBurst trigger={burst} />
            </Button>
            <Button variant="glass" size="lg" onClick={() => toggleWish(p.id)} aria-label="Toggle wishlist" aria-pressed={wishlist.includes(p.id)}>
              <Heart className={wishlist.includes(p.id) ? "fill-magenta text-magenta" : ""} />
            </Button>
          </div>
          <DeliverTo className="mt-3" />
          {blocked && <p className="mt-2 rounded-xl border border-ember/50 bg-ember/10 p-3 text-sm">{getCategory(p.category)?.name} can't be delivered to {deliveryState} right now due to local restrictions. Choose another state above or browse other categories.</p>}
          {t.discount > 0 && <p className="mt-2 text-sm text-emerald">You save {formatNaira(t.discount)} with bulk pricing 🎉</p>}
          {!soldOut && !p.preorder && p.stock < p.lowStockThreshold && <p className="mt-2 text-sm text-ember">Hurry — only {p.stock} left in stock.</p>}

          <details className="glass mt-6 rounded-2xl p-4" open>
            <summary className="flex cursor-pointer items-center gap-2 font-semibold"><ShieldAlert className="h-4 w-4 text-ember" /> Safety instructions</summary>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Adults 18+ only. Read the label before use.</li>
              <li>Place on flat, firm ground at least {Math.max(5, p.heightM / 2)}m from people, cars and buildings.</li>
              <li>Light at arm's length and step back immediately. Never lean over the firework.</li>
              <li>Never relight a dud — wait 20 minutes, then soak in water.</li>
              <li>Keep a bucket of water or sand nearby.</li>
            </ul>
          </details>
        </div>
      </div>

      <section id="reviews" className="mt-20 scroll-mt-28">
        <SectionTitle eyebrow="Reviews" title="What customers say" />
        <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
          <div className="glass h-fit rounded-2xl p-5">
            <div className="font-display text-5xl text-gold">{r.avg.toFixed(1)}</div>
            <Stars value={r.avg} size={18} />
            <p className="mt-1 text-sm text-muted-foreground">{r.count} reviews</p>
            <div className="mt-4 space-y-1.5">
              {r.breakdown.map((b) => (
                <div key={b.star} className="flex items-center gap-2 text-xs">
                  <span className="w-3">{b.star}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-gold-gradient" style={{ width: `${r.count ? (b.count / r.count) * 100 : 0}%` }} /></div>
                  <span className="w-4 text-right text-muted-foreground">{b.count}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Only verified buyers can review. Bought this? Leave a review from <Link to="/account" search={{ tab: "reviews" }} className="text-gold underline">My account</Link>.</p>
          </div>
          <div className="space-y-4">
            {reviews.length === 0 && <p className="text-muted-foreground">No reviews yet. Be the first to light it up!</p>}
            {reviews.map((rv) => (
              <article key={rv.id} className="glass rounded-2xl p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Stars value={rv.rating} />
                  <h3 className="font-sans text-sm font-bold">{rv.title}</h3>
                  {rv.verified && <span className="flex items-center gap-1 rounded-full bg-emerald/15 px-2 py-0.5 text-[10px] font-semibold text-emerald"><BadgeCheck className="h-3 w-3" /> Verified Purchase</span>}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{rv.body}</p>
                {rv.media && (
                  <div className="mt-3 flex gap-2">
                    {rv.media.map((m, i) => (
                      <ReviewMediaThumb key={i} m={m} poster={p.image} />
                    ))}
                  </div>
                )}
                <p className="mt-3 text-xs text-muted-foreground">{rv.author} · {rv.city} · {rv.date}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-20">
        <SectionTitle eyebrow="More sparkle" title="You might also like" />
        <ProductGrid products={relatedProducts(cat, p)} />
      </section>
    </div>
  );
}

function Spec({ icon, label }: { icon: React.ReactNode; label: string }) {
  return <span className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:text-gold">{icon}{label}</span>;
}
