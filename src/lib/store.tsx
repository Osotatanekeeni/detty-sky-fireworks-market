// Per-browser shopping state: cart, wishlist, chosen delivery state and orders placed from this
// browser. The signed-in user lives in auth.tsx (Supabase Auth) and saved addresses in
// addresses.ts (the `addresses` table).
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useCatalogue } from "./catalogue";
import { priceCart } from "./checkout";
import { db, useDb } from "./mock-db";
import type { StateName } from "./types";

export interface CartLine { key: string; productId?: string; bundleId?: string; qty: number; }

interface Store {
  cart: CartLine[];
  wishlist: string[];
  /** Order ids placed from this browser (so guests can find them again). */
  orderIds: string[];
  deliveryState: StateName | null;
  bump: number;
  add: (line: Omit<CartLine, "key">) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  toggleWish: (id: string) => void;
  rememberOrder: (id: string) => void;
  setDeliveryState: (s: StateName | null) => void;
}

const Ctx = createContext<Store | null>(null);
const KEY = "detty-sky-v1";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [wishlist, setWish] = useState<string[]>([]);
  const [orderIds, setOrderIds] = useState<string[]>([]);
  const [deliveryState, setDeliveryState] = useState<StateName | null>(null);
  const [bump, setBump] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    db.hydrate();
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "{}");
      setCart(s.cart ?? []); setWish(s.wishlist ?? []);
      setOrderIds(s.orderIds ?? []); setDeliveryState(s.deliveryState ?? null);
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ cart, wishlist, orderIds, deliveryState }));
    } catch { /* ignore */ }
  }, [cart, wishlist, orderIds, deliveryState, loaded]);

  const add = useCallback((l: Omit<CartLine, "key">) => {
    const key = l.productId ? `p:${l.productId}` : `b:${l.bundleId}`;
    setCart((c) => {
      const ex = c.find((x) => x.key === key);
      return ex ? c.map((x) => (x.key === key ? { ...x, qty: x.qty + l.qty } : x)) : [...c, { ...l, key }];
    });
    setBump((b) => b + 1);
  }, []);

  const value: Store = {
    cart, wishlist, orderIds, deliveryState, bump, add,
    setQty: (key, qty) => setCart((c) => c.map((x) => (x.key === key ? { ...x, qty: Math.max(1, qty) } : x))),
    remove: (key) => setCart((c) => c.filter((x) => x.key !== key)),
    clear: () => setCart([]),
    toggleWish: (id) => setWish((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id])),
    rememberOrder: (id) => setOrderIds((ids) => (ids.includes(id) ? ids : [id, ...ids])),
    setDeliveryState,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside provider");
  return s;
}

/** Cart lines priced with the same function checkout uses. */
export function useCartDetails() {
  const { cart } = useStore();
  const catalogue = useCatalogue();
  const { codes } = useDb();
  return useMemo(() => {
    const priced = priceCart({ ...catalogue, codes }, { lines: cart });
    const lines = priced.lines.map((l) => ({
      ...l,
      key: l.key,
      productId: l.kind === "product" ? l.id : undefined,
      bundleId: l.kind === "bundle" ? l.id : undefined,
      preorder: l.preorderArrives ? { arrives: l.preorderArrives } : undefined,
    }));
    const count = lines.reduce((s, l) => s + l.qty, 0);
    return { lines, subtotal: priced.subtotal, discount: priced.bulkDiscount, total: priced.subtotal - priced.bulkDiscount, count };
  }, [cart, catalogue, codes]);
}
