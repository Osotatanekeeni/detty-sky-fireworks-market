import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { SparkBurst } from "@/components/site/Fireworks";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/pricing";
import { bundleValue, getProductById, listBundles } from "@/lib/services";
import { useStore } from "@/lib/store";
import type { Bundle } from "@/lib/types";

export const Route = createFileRoute("/bundles")({
  head: () => ({
    meta: [
      { title: "Fireworks Bundles & Packs — Detty Sky" },
      { name: "description", content: "Curated fireworks packs for New Year, owambe, birthdays and church crossover — at a discount." },
      { property: "og:title", content: "Fireworks Bundles — Detty Sky" },
      { property: "og:description", content: "Save more with curated packs." },
    ],
  }),
  component: Bundles,
});

function Bundles() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-xs uppercase tracking-[0.2em] text-magenta">Bundles</p>
      <h1 className="text-3xl sm:text-5xl">Packs that <span className="text-gold-gradient">pack a punch</span></h1>
      <p className="mt-2 max-w-xl text-muted-foreground">Hand-picked combos so you don't have to think. Just light am.</p>
      <div className="mt-10 grid gap-6 md:grid-cols-2">{listBundles().map((b) => <BundleCard key={b.id} b={b} />)}</div>
    </div>
  );
}

function BundleCard({ b }: { b: Bundle }) {
  const { add } = useStore();
  const [burst, setBurst] = useState(0);
  const value = bundleValue(b);
  return (
    <article className="glass overflow-hidden rounded-3xl shadow-card">
      <div className="relative">
        <img src={b.image} alt={b.name} loading="lazy" className="aspect-[16/9] w-full object-cover" />
        <span className="absolute left-3 top-3 rounded-full bg-magenta px-3 py-1 text-xs font-bold">Save {formatNaira(value - b.price)} ({Math.round((1 - b.price / value) * 100)}%)</span>
      </div>
      <div className="p-5">
        <h2 className="text-xl">{b.name}</h2>
        <p className="text-sm text-muted-foreground">{b.tagline}</p>
        <ul className="mt-4 space-y-1.5 text-sm">
          {b.items.map((i) => {
            const p = getProductById(i.productId)!;
            return <li key={i.productId} className="flex justify-between"><span>{i.qty} × {p.name}</span><span className="text-muted-foreground">{formatNaira(p.price * i.qty)}</span></li>;
          })}
        </ul>
        <div className="mt-5 flex items-center justify-between">
          <div><span className="font-display text-2xl text-gold">{formatNaira(b.price)}</span> <span className="text-sm text-muted-foreground line-through">{formatNaira(value)}</span></div>
          <Button variant="gold" className="relative" onClick={() => { add({ bundleId: b.id, qty: 1 }); setBurst((x) => x + 1); toast.success(`${b.name} added`); }}>
            Add pack <SparkBurst trigger={burst} />
          </Button>
        </div>
      </div>
    </article>
  );
}
