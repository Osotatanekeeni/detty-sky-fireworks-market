export type StateName = "Akwa Ibom" | "Bayelsa" | "Cross River" | "Delta" | "Edo" | "Rivers";
export type CategorySlug =
  | "aerial-cakes" | "rockets" | "fountains" | "sparklers" | "smoke-colour" | "confetti-cannons" | "wedding-party";
export type OccasionSlug = "christmas" | "new-year" | "wedding-entrance" | "birthday" | "church-crossover";
export type NoiseLevel = "Quiet" | "Medium" | "Loud";

export interface Category { slug: CategorySlug; name: string; blurb: string; }
export interface Occasion { slug: OccasionSlug; name: string; blurb: string; emoji: string; }
export interface PriceTier { minQty: number; discountPct: number; }

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: CategorySlug;
  occasions: OccasionSlug[];
  price: number;
  compareAt?: number;
  image: string;
  gallery: string[];
  videoPoster: string;
  durationSec: number;
  shots: number;
  heightM: number;
  noise: NoiseLevel;
  colours: string[];
  description: string;
  stock: number;
  /** Units held by unpaid orders. Sellable = stock - reserved. */
  reserved?: number;
  lowStockThreshold: number;
  tiers: PriceTier[];
  /** `arrives` is an ISO date (YYYY-MM-DD); show it with formatArrives(). */
  preorder?: { arrives: string };
  bestSeller?: boolean;
}

export interface Review {
  id: string;
  productId: string;
  author: string;
  city: string;
  rating: number;
  title: string;
  body: string;
  date: string;
  verified: boolean;
  media?: { type: "photo" | "video"; src: string }[];
  status: "approved" | "hidden" | "pending";
  /** The order this review is tied to — what makes it a "verified purchase". */
  orderId?: string;
}

export interface Bundle {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  image: string;
  items: { productId: string; qty: number }[];
  price: number;
}

export interface City { name: string; fee: number; days: number; }
export interface DeliveryZone { state: StateName; cities: City[]; }

export type OrderStatus = "Processing" | "Dispatched" | "Out for Delivery" | "Delivered";
export interface OrderLine {
  /** Product id, or bundle id when `kind` is "bundle", or "custom" for admin-created lines (e.g. converted bulk quotes). */
  productId: string;
  kind?: "product" | "bundle" | "custom";
  name: string;
  qty: number;
  unitPrice: number;
  preorderArrives?: string;
}
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export interface Payment { provider: "paystack"; reference: string; channel: "card" | "bank_transfer" | "ussd" | "manual"; status: PaymentStatus; paidAt?: string; }
export interface Order {
  id: string;
  createdAt: string;
  customer: { name: string; email: string; phone: string };
  address: { state: StateName; city: string; street: string };
  lines: OrderLine[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  status: OrderStatus;
  history: { status: OrderStatus; at: string }[];
  eta: string;
  /** Discount-code savings (bulk discounts are in `discount`). */
  codeDiscount?: number;
  code?: string;
  payment?: Payment;
  /** Set when an order was created from a bulk quote. */
  quoteId?: string;
  note?: string;
}

export type QuoteStatus = "New" | "Quoted" | "Converted" | "Closed";
export interface BulkQuote {
  id: string;
  name: string;
  orgType: string;
  eventDate: string;
  state: StateName;
  city: string;
  request: string;
  quantity: string;
  phone: string;
  notes: string;
  status: QuoteStatus;
  createdAt: string;
  email?: string;
  response?: string;
  quotedAmount?: number;
  orderId?: string;
}

export interface DiscountCode { code: string; pct: number; active: boolean; uses: number; }

export interface Banner { id: string; title: string; subtitle: string; cta: string; href: string; tone: "gold" | "party" | "royal"; active: boolean; }
export interface Campaign {
  /** Text in the announcement bar above the header. */
  announcement: string;
  preordersOpen: boolean;
  /** Label above the hero countdown. */
  countdownLabel: string;
}
export interface Address { id: string; label: string; state: StateName; city: string; street: string; phone: string; }
