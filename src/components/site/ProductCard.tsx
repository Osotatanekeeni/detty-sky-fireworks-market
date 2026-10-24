import { Link } from "@tanstack/react-router";
import { Heart, ShoppingBag, Star } from "lucide-react";
import { useState } from "react";
import { getCategory, isCategoryBlocked, ratingFor } from "@/lib/services";
import { formatNaira } from "@/lib/pricing";
import { useCatalogue } from "@/lib/catalogue";
import { formatArrives } from "@/lib/db-map";
import { useStore } from "@/lib/store";
import type { Product } from "@/lib/types";
import { SparkBurst } from "./Fireworks";

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} style={{ width: size, height: size }} className={i <= Math.round(value) ? "fill-gold text-gold" : "text-muted-foreground/40"} />
      ))}
    </span>
  );
}

export function ProductCard({ p }: { p: Product }) {
  const { add, wishlist, toggleWish, deliveryState } = useStore();
  const [burst, setBurst] = useState(0);
  const cat = useCatalogue();
  const blocked = isCategoryBlocked(cat, deliveryState ?? undefined, p.category);
  const soldOut = !p.preorder && p.stock <= 0;
  const r = ratingFor(cat, p.id);
  const wished = wishlist.includes(p.id);
  return (
    <article className="group glass relative flex flex-col overflow-hidden rounded-2xl shadow-card transition-all hover:-translate-y-1 hover:border-gold/50">
      <Link to="/product/$slug" params={{ slug: p.slug }} className="relative block aspect-square overflow-hidden">
        <img src={p.image} alt={p.name} loading="lazy" width={816} height={816} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {p.preorder && <span className="rounded-full bg-royal px-2 py-0.5 text-[10px] font-bold uppercase">Pre-order · {formatArrives(p.preorder.arrives)}</span>}
          {p.bestSeller && <span className="rounded-full bg-gold-gradient px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">Best seller</span>}
          {blocked && <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold uppercase">Not in {deliveryState}</span>}
          {soldOut && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase">Sold out</span>}
          {!soldOut && p.stock < p.lowStockThreshold && !p.preorder && <span className="rounded-full bg-ember px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">Only {p.stock} left</span>}
        </div>
      </Link>
      <button
        onClick={() => toggleWish(p.id)}
        aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
        aria-pressed={wished}
        className="absolute right-2 top-2 rounded-full bg-background/70 p-2 backdrop-blur"
      >
        <Heart className={`h-4 w-4 ${wished ? "fill-magenta text-magenta" : ""}`} />
      </button>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{getCategory(p.category)?.name}</p>
        <Link to="/product/$slug" params={{ slug: p.slug }} className="line-clamp-2 text-sm font-semibold leading-snug hover:text-gold">{p.name}</Link>
        <div className="flex items-center gap-1 text-xs text-muted-foreground"><Stars value={r.avg} size={12} /> ({r.count})</div>
        <div className="mt-auto flex items-end justify-between pt-2">
          <div>
            <div className="font-display text-base text-gold">{formatNaira(p.price)}</div>
            {p.compareAt && <div className="text-xs text-muted-foreground line-through">{formatNaira(p.compareAt)}</div>}
          </div>
          <button
            onClick={() => { add({ productId: p.id, qty: 1 }); setBurst((b) => b + 1); }}
            disabled={blocked || soldOut}
            className="relative rounded-full bg-gold-gradient p-2.5 text-primary-foreground transition-transform active:scale-90 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={`Add ${p.name} to cart`}
          >
            <ShoppingBag className="h-4 w-4" />
            <SparkBurst trigger={burst} />
          </button>
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => <ProductCard key={p.id} p={p} />)}
    </div>
  );
}

export function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-magenta">{eyebrow}</p>}
        <h2 className="text-2xl sm:text-3xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}
