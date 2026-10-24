import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { BUNDLES } from "./data";
import { lineTotals } from "./pricing";
import { getProductById } from "./services";
import type { Order } from "./types";

export interface CartLine { key: string; productId?: string; bundleId?: string; qty: number; }
interface User { name: string; email: string; }

interface Store {
  cart: CartLine[];
  wishlist: string[];
  user: User | null;
  myOrders: Order[];
  bump: number;
  add: (line: Omit<CartLine, "key">) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  toggleWish: (id: string) => void;
  login: (u: User | null) => void;
  saveOrder: (o: Order) => void;
}

const Ctx = createContext<Store | null>(null);
const KEY = "detty-sky-v1";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [wishlist, setWish] = useState<string[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [myOrders, setOrders] = useState<Order[]>([]);
  const [bump, setBump] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "{}");
      setCart(s.cart ?? []); setWish(s.wishlist ?? []); setUser(s.user ?? null); setOrders(s.myOrders ?? []);
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify({ cart, wishlist, user, myOrders }));
  }, [cart, wishlist, user, myOrders, loaded]);

  const add = useCallback((l: Omit<CartLine, "key">) => {
    const key = l.productId ? `p:${l.productId}` : `b:${l.bundleId}`;
    setCart((c) => {
      const ex = c.find((x) => x.key === key);
      return ex ? c.map((x) => (x.key === key ? { ...x, qty: x.qty + l.qty } : x)) : [...c, { ...l, key }];
    });
    setBump((b) => b + 1);
  }, []);

  const value: Store = {
    cart, wishlist, user, myOrders, bump, add,
    setQty: (key, qty) => setCart((c) => c.map((x) => (x.key === key ? { ...x, qty: Math.max(1, qty) } : x))),
    remove: (key) => setCart((c) => c.filter((x) => x.key !== key)),
    clear: () => setCart([]),
    toggleWish: (id) => setWish((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id])),
    login: setUser,
    saveOrder: (o) => setOrders((os) => [o, ...os]),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside provider");
  return s;
}

export function useCartDetails() {
  const { cart } = useStore();
  return useMemo(() => {
    const lines = cart.map((l) => {
      if (l.productId) {
        const p = getProductById(l.productId);
        if (!p) return null;
        const t = lineTotals(p.price, l.qty, p.tiers);
        return { ...l, name: p.name, image: p.image, unit: p.price, ...t, preorder: p.preorder, category: p.category };
      }
      const b = BUNDLES.find((x) => x.id === l.bundleId);
      if (!b) return null;
      return { ...l, name: b.name, image: b.image, unit: b.price, full: b.price * l.qty, total: b.price * l.qty, discount: 0, preorder: undefined, category: undefined };
    }).filter((x): x is NonNullable<typeof x> => !!x);
    const subtotal = lines.reduce((s, l) => s + l.full, 0);
    const discount = lines.reduce((s, l) => s + l.discount, 0);
    const count = lines.reduce((s, l) => s + l.qty, 0);
    return { lines, subtotal, discount, total: subtotal - discount, count };
  }, [cart]);
}
