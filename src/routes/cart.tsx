import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/pricing";
import { useCartDetails, useStore } from "@/lib/store";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your Cart — Detty Sky" },
      { name: "description", content: "Review your fireworks, bulk discounts and subtotal." },
      { property: "og:title", content: "Your Cart — Detty Sky" },
      { property: "og:description", content: "Review your fireworks order." },
    ],
  }),
  component: Cart,
});

function Cart() {
  const { lines, subtotal, discount, total } = useCartDetails();
  const { setQty, remove } = useStore();
  if (!lines.length)
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="text-5xl">🎆</p>
        <h1 className="mt-4 text-2xl">Your cart is empty</h1>
        <p className="mt-2 text-muted-foreground">The sky is waiting. Let's fill it up.</p>
        <Button asChild variant="gold" size="lg" className="mt-6"><Link to="/shop">Start shopping</Link></Button>
      </div>
    );
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl">Your cart</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <ul className="space-y-3">
          {lines.map((l) => (
            <li key={l.key} className="glass flex gap-4 rounded-2xl p-3">
              <img src={l.image} alt="" className="h-24 w-24 rounded-xl object-cover" loading="lazy" />
              <div className="flex flex-1 flex-col">
                <div className="flex justify-between gap-2">
                  <p className="font-semibold">{l.name}</p>
                  <button onClick={() => remove(l.key)} aria-label={`Remove ${l.name}`} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
                <p className="text-xs text-muted-foreground">{formatNaira(l.unit)} each{l.bundleId ? " · bundle" : ""}{l.preorder ? ` · Pre-order, arrives ${l.preorder.arrives}` : ""}</p>
                {l.discount > 0 && <p className="text-xs font-semibold text-emerald">Bulk discount −{formatNaira(l.discount)}</p>}
                <div className="mt-auto flex items-center justify-between pt-2">
                  <div className="flex items-center rounded-full border border-border">
                    <button className="p-2" onClick={() => setQty(l.key, l.qty - 1)} aria-label="Decrease"><Minus className="h-3 w-3" /></button>
                    <span className="w-8 text-center text-sm">{l.qty}</span>
                    <button className="p-2" onClick={() => setQty(l.key, l.qty + 1)} aria-label="Increase"><Plus className="h-3 w-3" /></button>
                  </div>
                  <span className="font-display text-gold">{formatNaira(l.total)}</span>
                </div>
              </div>
            </li>
          ))}
          <p className="text-xs text-muted-foreground">💡 Buy 10+ of any item for 5% off, 25+ for 10% off — applied automatically.</p>
        </ul>
        <aside className="glass h-fit rounded-2xl p-5">
          <h2 className="text-lg">Summary</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatNaira(subtotal)}</dd></div>
            {discount > 0 && <div className="flex justify-between text-emerald"><dt>Bulk discount</dt><dd>−{formatNaira(discount)}</dd></div>}
            <div className="flex justify-between text-muted-foreground"><dt>Delivery</dt><dd>At checkout</dd></div>
            <div className="flex justify-between border-t border-border pt-3 font-display text-lg"><dt>Total</dt><dd className="text-gold">{formatNaira(total)}</dd></div>
          </dl>
          <Button asChild variant="gold" size="lg" className="mt-5 w-full"><Link to="/checkout">Checkout</Link></Button>
          <Link to="/shop" className="mt-3 block text-center text-sm text-muted-foreground hover:text-gold">Continue shopping</Link>
        </aside>
      </div>
    </div>
  );
}
