// In-browser mock database — what's LEFT of it after Phase 1.
//
// The catalogue (products, bundles, reviews, zones, blocks, banners, campaign) now lives in
// Supabase (see catalogue.ts). This still holds orders, bulk quotes and discount codes until
// checkout moves to Supabase in Phase 2, persists them to localStorage, and exposes a tiny
// subscribe API for React.
//
// Rules:
// - Components never import this directly for writes; they go through `services.ts`
//   (reads) and `actions.ts` (writes), which are the functions that become server
//   functions later.
// - The server render always sees the seed data; the browser swaps in persisted data
//   after hydration (`hydrated` flips to true). Pages that show browser-created data
//   (orders, account, admin) must wait for `hydrated` before deciding "not found".
import { useSyncExternalStore } from "react";
import { DISCOUNT_CODES, ORDERS, QUOTES } from "./data";
import type { BulkQuote, DiscountCode, Order, Review } from "./types";

export interface DbState {
  orders: Order[];
  quotes: BulkQuote[];
  codes: DiscountCode[];
  /** Reviews customers submit for mock orders. Real reviews need a real order item (Phase 2). */
  reviews: Review[];
  hydrated: boolean;
}

// v2: v1 also held the catalogue, which now comes from Supabase.
const KEY = "detty-sky-mockdb-v2";

const seed = (): DbState => ({
  orders: ORDERS,
  quotes: QUOTES,
  codes: DISCOUNT_CODES,
  reviews: [],
  hydrated: false,
});

const SERVER_STATE = seed();
let state: DbState = SERVER_STATE;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function persist() {
  try {
    const { hydrated: _h, ...rest } = state;
    localStorage.setItem(KEY, JSON.stringify(rest));
  } catch {
    /* storage full or blocked — demo keeps working in memory */
  }
}

export const db = {
  get: () => state,
  /** Apply a change. Pass a function that returns only the tables it changed. */
  set(fn: (s: DbState) => Partial<Omit<DbState, "hydrated">>) {
    state = { ...state, ...fn(state) };
    persist();
    emit();
  },
  /** Load persisted browser data. Called once from StoreProvider after mount. */
  hydrate() {
    if (state.hydrated) return;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) state = { ...seed(), ...(JSON.parse(raw) as Partial<DbState>), hydrated: true };
      else state = { ...state, hydrated: true };
    } catch {
      state = { ...state, hydrated: true };
    }
    emit();
  },
  /** Wipe demo data back to the seed (admin → "Reset demo data"). */
  reset() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    state = { ...seed(), hydrated: true };
    emit();
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

/** Subscribe a component to the mock database. Re-renders on every change. */
export function useDb(): DbState {
  return useSyncExternalStore(db.subscribe, db.get, () => SERVER_STATE);
}
