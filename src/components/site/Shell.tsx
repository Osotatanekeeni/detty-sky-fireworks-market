import { Link, useNavigate } from "@tanstack/react-router";
import { Heart, MapPin, Menu, MessageCircle, Search, ShoppingBag, Sparkles, User, X } from "lucide-react";
import type { StateName } from "@/lib/types";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { CATEGORIES, OCCASIONS, STATES, WHATSAPP_NUMBER } from "@/lib/data";
import { useCatalogue } from "@/lib/catalogue";
import { formatNaira } from "@/lib/pricing";
import { listProducts } from "@/lib/services";
import { useCartDetails, useStore } from "@/lib/store";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2" aria-label="Detty Sky home">
      <Sparkles className="h-6 w-6 text-gold" />
      <span className="font-display text-lg font-bold tracking-tight">
        Detty<span className="text-gold-gradient">Sky</span>
      </span>
    </Link>
  );
}

function InstantSearch({ onDone }: { onDone?: () => void }) {
  const [q, setQ] = useState("");
  const nav = useNavigate();
  const cat = useCatalogue();
  const results = q.length > 1 ? listProducts(cat, { q }).slice(0, 5) : [];
  return (
    <div className="relative w-full">
      <form
        onSubmit={(e) => { e.preventDefault(); nav({ to: "/shop", search: { q } }); setQ(""); onDone?.(); }}
        className="glass flex items-center gap-2 rounded-full px-4 py-2"
        role="search"
      >
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search rockets, sparklers…"
          aria-label="Search products"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </form>
      {results.length > 0 && (
        <ul className="glass absolute inset-x-0 top-12 z-50 overflow-hidden rounded-2xl p-1 shadow-card">
          {results.map((p) => (
            <li key={p.id}>
              <Link
                to="/product/$slug" params={{ slug: p.slug }}
                onClick={() => { setQ(""); onDone?.(); }}
                className="flex items-center gap-3 rounded-xl p-2 hover:bg-accent"
              >
                <img src={p.image} alt="" className="h-10 w-10 rounded-lg object-cover" loading="lazy" />
                <span className="flex-1 text-sm">{p.name}</span>
                <span className="text-sm font-semibold text-gold">{formatNaira(p.price)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** "Deliver to" picker — drives the per-state category kill switch on product pages. */
export function DeliverTo({ className = "" }: { className?: string }) {
  const { deliveryState, setDeliveryState } = useStore();
  return (
    <label className={`flex items-center gap-1.5 text-xs text-muted-foreground ${className}`}>
      <MapPin className="h-3.5 w-3.5 text-gold" />
      <span className="sr-only sm:not-sr-only">Deliver to</span>
      <select value={deliveryState ?? ""} onChange={(e) => setDeliveryState((e.target.value || null) as StateName | null)}
        className="cursor-pointer bg-transparent font-semibold text-foreground outline-none" aria-label="Delivery state">
        <option value="" className="bg-card">Choose state</option>
        {STATES.map((st) => <option key={st} value={st} className="bg-card">{st}</option>)}
      </select>
    </label>
  );
}

function Header() {
  const { count } = useCartDetails();
  const { bump, wishlist } = useStore();
  const { campaign } = useCatalogue();
  const [open, setOpen] = useState(false);
  const [anim, setAnim] = useState(false);
  useEffect(() => {
    if (!bump) return;
    setAnim(true);
    const t = setTimeout(() => setAnim(false), 650);
    return () => clearTimeout(t);
  }, [bump]);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      {campaign.announcement && (
        <div className="bg-party-gradient py-1.5 text-center text-xs font-semibold text-primary-foreground">
          {campaign.preordersOpen ? <Link to="/shop" search={{ preorder: true }} className="hover:underline">{campaign.announcement}</Link> : campaign.announcement}
        </div>
      )}
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu /></button>
        <Logo />
        <nav className="ml-6 hidden items-center gap-5 text-sm lg:flex">
          <Link to="/shop" className="hover:text-gold" activeProps={{ className: "text-gold" }}>Shop</Link>
          <Link to="/bundles" className="hover:text-gold" activeProps={{ className: "text-gold" }}>Bundles</Link>
          <Link to="/bulk" className="hover:text-gold" activeProps={{ className: "text-gold" }}>Bulk orders</Link>
          <Link to="/safety" className="hover:text-gold" activeProps={{ className: "text-gold" }}>Safety</Link>
          <Link to="/delivery" className="hover:text-gold" activeProps={{ className: "text-gold" }}>Delivery</Link>
        </nav>
        <div className="ml-auto hidden w-72 md:block"><InstantSearch /></div>
        <DeliverTo className="hidden xl:flex" />
        <div className="ml-auto flex items-center gap-1 md:ml-2">
          <Link to="/account" search={{ tab: "wishlist" }} className="relative rounded-full p-2 hover:bg-accent" aria-label={`Wishlist, ${wishlist.length} items`}>
            <Heart className="h-5 w-5" />
            {wishlist.length > 0 && <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-magenta" />}
          </Link>
          <Link to="/account" className="rounded-full p-2 hover:bg-accent" aria-label="Account"><User className="h-5 w-5" /></Link>
          <Link to="/cart" className={`relative rounded-full p-2 hover:bg-accent ${anim ? "animate-cart-bounce" : ""}`} aria-label={`Cart, ${count} items`}>
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-gradient px-1 text-[10px] font-bold text-primary-foreground">{count}</span>
            )}
          </Link>
        </div>
      </div>
      <div className="flex items-center gap-3 px-4 pb-3 md:hidden"><InstantSearch /></div>

      {open && (
        <div className="fixed inset-0 z-50 bg-background/95 p-6 backdrop-blur-xl lg:hidden" role="dialog" aria-label="Menu">
          <div className="flex items-center justify-between"><Logo /><button onClick={() => setOpen(false)} aria-label="Close menu"><X /></button></div>
          <div className="mt-8 grid gap-6">
            <DeliverTo className="glass w-fit rounded-full px-3 py-2 text-sm" />
            <div>
              <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Categories</p>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((c) => (
                  <Link key={c.slug} to="/shop" search={{ category: c.slug }} onClick={() => setOpen(false)} className="glass rounded-xl p-3 text-sm">{c.name}</Link>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Occasions</p>
              <div className="flex flex-wrap gap-2">
                {OCCASIONS.map((o) => (
                  <Link key={o.slug} to="/shop" search={{ occasion: o.slug }} onClick={() => setOpen(false)} className="glass rounded-full px-3 py-1.5 text-sm">{o.emoji} {o.name}</Link>
                ))}
              </div>
            </div>
            <nav className="grid gap-3 font-display text-xl">
              {([["/shop", "Shop all"], ["/bundles", "Bundles"], ["/bulk", "Bulk quote"], ["/safety", "Safety guide"], ["/delivery", "Delivery info"], ["/track", "Track an order"], ["/account", "My account"]] as const).map(([to, l]) => (
                <Link key={to} to={to} onClick={() => setOpen(false)}>{l}</Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-24 border-t border-border/60 bg-night/60">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo />
          <p className="mt-3 text-sm text-muted-foreground">Premium fireworks for the South-South. Make your December detty.</p>
          <div className="mt-4 flex gap-3 text-sm text-muted-foreground">
            <a href="https://instagram.com" className="hover:text-gold">Instagram</a>
            <a href="https://tiktok.com" className="hover:text-gold">TikTok</a>
            <a href="https://x.com" className="hover:text-gold">X</a>
          </div>
        </div>
        <div>
          <h3 className="mb-3 text-sm">Shop</h3>
          <ul className="grid gap-2 text-sm text-muted-foreground">
            {CATEGORIES.slice(0, 5).map((c) => <li key={c.slug}><Link to="/shop" search={{ category: c.slug }} className="hover:text-gold">{c.name}</Link></li>)}
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm">Help</h3>
          <ul className="grid gap-2 text-sm text-muted-foreground">
            <li><Link to="/safety" className="hover:text-gold">Safety guide</Link></li>
            <li><Link to="/delivery" className="hover:text-gold">Delivery info</Link></li>
            <li><Link to="/bulk" className="hover:text-gold">Bulk quotes</Link></li>
            <li><Link to="/track" className="hover:text-gold">Track my order</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm">Contact</h3>
          <p className="text-sm text-muted-foreground">hello@dettysky.ng<br />+234 800 000 0000<br />We deliver to: {STATES.join(", ")}.</p>
        </div>
      </div>
      <div className="border-t border-border/60 px-4 py-5 text-center text-xs text-muted-foreground">
        🔥 Please use fireworks responsibly. Adults 18+ only. Keep away from children, pets and buildings. © {new Date().getFullYear()} Detty Sky.
      </div>
    </footer>
  );
}

function WhatsAppButton() {
  return (
    <a
      href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hi Detty Sky! I need help with an order.")}`}
      target="_blank" rel="noreferrer"
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-whatsapp text-primary-foreground shadow-card transition-transform hover:scale-110"
      aria-label="Chat with us on WhatsApp"
    >
      <MessageCircle className="h-7 w-7" />
    </a>
  );
}

function AgeGate() {
  const [state, setState] = useState<"hidden" | "ask" | "under">("hidden");
  useEffect(() => {
    try { if (localStorage.getItem("detty-age-ok") !== "1") setState("ask"); } catch { setState("ask"); }
  }, []);
  if (state === "hidden") return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-night/95 p-6 backdrop-blur-xl" role="dialog" aria-modal="true" aria-labelledby="age-title">
      <div className="glass max-w-md rounded-3xl p-8 text-center shadow-glow">
        <Sparkles className="mx-auto h-10 w-10 text-gold" />
        {state === "ask" ? (
          <>
            <h2 id="age-title" className="mt-4 text-2xl">Are you 18 or older?</h2>
            <p className="mt-2 text-sm text-muted-foreground">Fireworks are sold to adults only. Please confirm your age to enter Detty Sky.</p>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="gold" size="lg" autoFocus onClick={() => { try { localStorage.setItem("detty-age-ok", "1"); } catch { /* private mode */ } setState("hidden"); }}>Yes, I'm 18+</Button>
              <Button variant="glass" size="lg" onClick={() => setState("under")}>No</Button>
            </div>
          </>
        ) : (
          <>
            <h2 id="age-title" className="mt-4 text-2xl">Sorry, not yet!</h2>
            <p className="mt-2 text-sm text-muted-foreground">You need to be 18 or older to shop with us. Ask a grown-up to help light up your celebration safely. 💛</p>
            <Button variant="link" className="mt-4" onClick={() => setState("ask")}>I made a mistake</Button>
          </>
        )}
      </div>
    </div>
  );
}

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <>
      <AgeGate />
      <Header />
      <main className="min-h-[60vh]">{children}</main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
