// Converts between Supabase rows (kobo, snake_case, dates) and the UI types in types.ts
// (naira, camelCase). This is the ONLY place money crosses the kobo ↔ naira boundary.
import { STATES } from "./data";
import type {
  Banner,
  BulkQuote,
  Bundle,
  Campaign,
  CategorySlug,
  DeliveryZone,
  DiscountCode,
  NoiseLevel,
  OccasionSlug,
  Order,
  OrderStatus,
  PaymentStatus,
  Product,
  QuoteStatus,
  Review,
  StateName,
} from "./types";

export const toKobo = (naira: number) => Math.round(naira * 100);
export const toNaira = (kobo: number | string) => Number(kobo) / 100;

// ── Row shapes (the columns we select) ──────────────────────
export interface ProductRow {
  id: string;
  slug: string;
  name: string;
  category_slug: string;
  description: string;
  price_kobo: number;
  compare_at_kobo: number | null;
  duration_sec: number;
  shots: number;
  height_m: number | string;
  noise: NoiseLevel;
  colours: string[];
  stock: number;
  reserved: number;
  low_stock_threshold: number;
  preorder_arrives: string | null;
  best_seller: boolean;
  product_occasions: { occasion_slug: string }[];
  product_media: { kind: "image" | "video" | "poster"; url: string; sort: number }[];
  price_tiers: { min_qty: number; discount_pct: number }[];
}
export interface BundleRow {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  image_url: string;
  price_kobo: number;
  bundle_items: { product_id: string; qty: number }[];
}
export interface CityRow {
  state: StateName;
  name: string;
  fee_kobo: number;
  days: number;
}
export interface BlockRow {
  category_slug: string;
  state: StateName;
}
export interface BannerRow {
  id: string;
  title: string;
  subtitle: string;
  cta: string;
  href: string;
  tone: Banner["tone"];
  active: boolean;
  sort: number;
}
export interface CampaignRow {
  announcement: string;
  preorders_open: boolean;
  countdown_label: string;
}
export interface ReviewRow {
  id: string;
  product_id: string;
  rating: number;
  title: string;
  body: string;
  author_display: string;
  city: string;
  status: Review["status"];
  created_at: string;
  review_media: { kind: "photo" | "video"; url: string }[];
}

export const PRODUCT_SELECT =
  "id, slug, name, category_slug, description, price_kobo, compare_at_kobo, duration_sec, shots, height_m, noise, colours, stock, reserved, low_stock_threshold, preorder_arrives, best_seller, product_occasions(occasion_slug), product_media(kind, url, sort), price_tiers(min_qty, discount_pct)";
export const BUNDLE_SELECT =
  "id, slug, name, tagline, image_url, price_kobo, bundle_items(product_id, qty)";
export const REVIEW_SELECT =
  "id, product_id, rating, title, body, author_display, city, status, created_at, review_media(kind, url)";

// ── Rows → UI ───────────────────────────────────────────────
export function productFromRow(r: ProductRow): Product {
  const media = [...r.product_media].sort((a, b) => a.sort - b.sort);
  const gallery = media.filter((m) => m.kind === "image").map((m) => m.url);
  const image = gallery[0] ?? "";
  const poster = media.find((m) => m.kind === "poster")?.url ?? image;
  const video = media.find((m) => m.kind === "video")?.url;
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    category: r.category_slug as CategorySlug,
    occasions: r.product_occasions.map((o) => o.occasion_slug as OccasionSlug),
    price: toNaira(r.price_kobo),
    ...(r.compare_at_kobo != null ? { compareAt: toNaira(r.compare_at_kobo) } : {}),
    image,
    gallery,
    videoPoster: poster,
    ...(video ? { video } : {}),
    durationSec: r.duration_sec,
    shots: r.shots,
    heightM: Number(r.height_m),
    noise: r.noise,
    colours: r.colours,
    description: r.description,
    stock: r.stock,
    reserved: r.reserved,
    lowStockThreshold: r.low_stock_threshold,
    tiers: [...r.price_tiers]
      .sort((a, b) => a.min_qty - b.min_qty)
      .map((t) => ({ minQty: t.min_qty, discountPct: t.discount_pct })),
    ...(r.preorder_arrives ? { preorder: { arrives: r.preorder_arrives } } : {}),
    ...(r.best_seller ? { bestSeller: true } : {}),
  };
}

export const bundleFromRow = (r: BundleRow): Bundle => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  tagline: r.tagline,
  image: r.image_url,
  price: toNaira(r.price_kobo),
  items: r.bundle_items.map((i) => ({ productId: i.product_id, qty: i.qty })),
});

/** Groups cities by state, in the fixed STATES order (every state appears, even if empty). */
export const zonesFromRows = (rows: CityRow[]): DeliveryZone[] =>
  STATES.map((state) => ({
    state,
    cities: rows
      .filter((c) => c.state === state)
      .map((c) => ({ name: c.name, fee: toNaira(c.fee_kobo), days: c.days })),
  }));

export function blocksFromRows(rows: BlockRow[]): Partial<Record<StateName, CategorySlug[]>> {
  const out: Partial<Record<StateName, CategorySlug[]>> = {};
  for (const b of rows) (out[b.state] ??= []).push(b.category_slug as CategorySlug);
  return out;
}

export const bannerFromRow = (r: BannerRow): Banner => ({
  id: r.id,
  title: r.title,
  subtitle: r.subtitle,
  cta: r.cta,
  href: r.href,
  tone: r.tone,
  active: r.active,
});

export const campaignFromRow = (r: CampaignRow): Campaign => ({
  announcement: r.announcement,
  preordersOpen: r.preorders_open,
  countdownLabel: r.countdown_label,
});

export const reviewFromRow = (r: ReviewRow): Review => ({
  id: r.id,
  productId: r.product_id,
  author: r.author_display,
  city: r.city,
  rating: r.rating,
  title: r.title,
  body: r.body,
  date: r.created_at.slice(0, 10),
  verified: true,
  status: r.status,
  ...(r.review_media.length
    ? { media: r.review_media.map((m) => ({ type: m.kind, src: m.url })) }
    : {}),
});

// ── UI → rows (admin writes) ────────────────────────────────
export const productToRow = (p: Product) => ({
  id: p.id,
  slug: p.slug,
  name: p.name,
  category_slug: p.category,
  description: p.description,
  price_kobo: toKobo(p.price),
  compare_at_kobo: p.compareAt != null && p.compareAt > p.price ? toKobo(p.compareAt) : null,
  duration_sec: p.durationSec,
  shots: p.shots,
  height_m: p.heightM,
  noise: p.noise,
  colours: p.colours,
  stock: p.stock,
  low_stock_threshold: p.lowStockThreshold,
  preorder_arrives: p.preorder?.arrives || null,
  best_seller: !!p.bestSeller,
});

/** Media rows for a product: the cover first, then the rest of the gallery, plus a poster row
 *  when the video poster isn't the cover (productFromRow falls back to the cover). */
export function productMediaRows(p: Product) {
  const images = [...new Set([p.image, ...p.gallery].filter(Boolean))];
  const rows: { product_id: string; kind: "image" | "poster" | "video"; url: string; sort: number }[] =
    images.map((url, sort) => ({ product_id: p.id, kind: "image", url, sort }));
  if (p.videoPoster && p.videoPoster !== images[0])
    rows.push({ product_id: p.id, kind: "poster", url: p.videoPoster, sort: 0 });
  if (p.video) rows.push({ product_id: p.id, kind: "video", url: p.video, sort: 0 });
  return rows;
}

export const bundleToRow = (b: Bundle) => ({
  id: b.id,
  slug: b.slug,
  name: b.name,
  tagline: b.tagline,
  image_url: b.image,
  price_kobo: toKobo(b.price),
});

export const bannerToRow = (b: Banner, sort: number) => ({ ...b, sort });

export const campaignToRow = (c: Campaign) => ({
  id: 1,
  announcement: c.announcement,
  preorders_open: c.preordersOpen,
  countdown_label: c.countdownLabel,
});

/** "2026-12-20" → "Dec 20". Anything that isn't an ISO date is shown as-is. */
export function formatArrives(arrives: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(arrives)) return arrives;
  return new Date(`${arrives}T12:00:00Z`).toLocaleDateString("en-NG", {
    month: "short",
    day: "numeric",
    timeZone: "Africa/Lagos",
  });
}

// ── Orders, quotes, codes ───────────────────────────────────
export type DbOrderStatus =
  | "pending_payment"
  | "processing"
  | "dispatched"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

const STATUS_TO_UI: Record<DbOrderStatus, OrderStatus> = {
  pending_payment: "Awaiting payment",
  processing: "Processing",
  dispatched: "Dispatched",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
export const statusToUi = (s: DbOrderStatus) => STATUS_TO_UI[s];
export const statusToDb = (s: OrderStatus) =>
  (Object.keys(STATUS_TO_UI) as DbOrderStatus[]).find((k) => STATUS_TO_UI[k] === s)!;

export interface OrderRow {
  id: string;
  number: string;
  email: string;
  customer_name: string;
  phone: string;
  state: StateName;
  city: string;
  street: string;
  status: DbOrderStatus;
  subtotal_kobo: number;
  bulk_discount_kobo: number;
  code: string | null;
  code_discount_kobo: number;
  delivery_fee_kobo: number;
  total_kobo: number;
  eta: string | null;
  quote_id: string | null;
  note: string;
  created_at: string;
  order_items: {
    id: string;
    kind: "product" | "bundle" | "custom";
    product_id: string | null;
    bundle_id: string | null;
    name: string;
    qty: number;
    unit_price_kobo: number;
    line_total_kobo: number;
    preorder_arrives: string | null;
  }[];
  order_status_events: { status: DbOrderStatus; created_at: string }[];
  payments: {
    provider: string;
    reference: string;
    channel: string | null;
    status: PaymentStatus;
    created_at: string;
    paid_at: string | null;
  }[];
}

export const ORDER_SELECT =
  "id, number, email, customer_name, phone, state, city, street, status, subtotal_kobo, bulk_discount_kobo, code, code_discount_kobo, delivery_fee_kobo, total_kobo, eta, quote_id, note, created_at, order_items(id, kind, product_id, bundle_id, name, qty, unit_price_kobo, line_total_kobo, preorder_arrives), order_status_events(status, created_at), payments(provider, reference, channel, status, created_at, paid_at)";

/** `limited`: the caller only proved the phone number — hide email and most of the street. */
export function orderFromRow(r: OrderRow, limited = false): Order {
  const pay = [...r.payments].sort((a, b) =>
    a.status === "paid" ? -1 : b.status === "paid" ? 1 : b.created_at.localeCompare(a.created_at),
  )[0];
  const history = [...r.order_status_events]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((e) => ({ status: statusToUi(e.status), at: e.created_at }));
  return {
    id: r.number,
    dbId: r.id,
    createdAt: r.created_at,
    customer: {
      name: r.customer_name,
      email: limited ? "" : r.email,
      phone: limited ? `••• ${r.phone.replace(/\D/g, "").slice(-4)}` : r.phone,
    },
    address: { state: r.state, city: r.city, street: limited ? "" : r.street },
    lines: r.order_items.map((i) => ({
      productId: i.product_id ?? i.bundle_id ?? "custom",
      kind: i.kind,
      name: i.name,
      qty: i.qty,
      unitPrice: toNaira(i.unit_price_kobo),
      itemId: i.id,
      ...(i.preorder_arrives ? { preorderArrives: i.preorder_arrives } : {}),
    })),
    subtotal: toNaira(r.subtotal_kobo),
    discount: toNaira(r.bulk_discount_kobo),
    deliveryFee: toNaira(r.delivery_fee_kobo),
    total: toNaira(r.total_kobo),
    status: statusToUi(r.status),
    history,
    eta: r.eta ?? "",
    ...(r.code ? { code: r.code, codeDiscount: toNaira(r.code_discount_kobo) } : {}),
    ...(pay
      ? {
          payment: {
            provider: pay.provider,
            reference: limited ? "" : pay.reference,
            channel: pay.channel ?? "",
            status: pay.status,
            ...(pay.paid_at ? { paidAt: pay.paid_at } : {}),
          },
        }
      : {}),
    ...(r.quote_id ? { quoteId: r.quote_id } : {}),
    ...(r.note ? { note: r.note } : {}),
    ...(limited ? { limited: true } : {}),
  };
}

export type DbQuoteStatus = "new" | "quoted" | "converted" | "closed";
export interface QuoteRow {
  id: string;
  name: string;
  org_type: string;
  event_date: string;
  state: StateName;
  city: string;
  request: string;
  quantity: string;
  phone: string;
  email: string | null;
  notes: string;
  status: DbQuoteStatus;
  response: string | null;
  quoted_kobo: number | null;
  order_id: string | null;
  created_at: string;
  orders?: { number: string } | null;
}
export const QUOTE_SELECT = "*, orders!bulk_quotes_order_id_fkey(number)";
const QUOTE_STATUS: Record<DbQuoteStatus, QuoteStatus> = {
  new: "New",
  quoted: "Quoted",
  converted: "Converted",
  closed: "Closed",
};
export const quoteStatusToDb = (s: QuoteStatus) => s.toLowerCase() as DbQuoteStatus;

export const quoteFromRow = (r: QuoteRow): BulkQuote => ({
  id: r.id,
  name: r.name,
  orgType: r.org_type,
  eventDate: r.event_date,
  state: r.state,
  city: r.city,
  request: r.request,
  quantity: r.quantity,
  phone: r.phone,
  notes: r.notes,
  status: QUOTE_STATUS[r.status],
  createdAt: r.created_at.slice(0, 10),
  ...(r.email ? { email: r.email } : {}),
  ...(r.response ? { response: r.response } : {}),
  ...(r.quoted_kobo != null ? { quotedAmount: toNaira(r.quoted_kobo) } : {}),
  ...(r.orders?.number ? { orderId: r.orders.number } : {}),
});

export interface CodeRow {
  code: string;
  pct: number;
  active: boolean;
  uses: number;
}
export const codeFromRow = (r: CodeRow): DiscountCode => ({ ...r });
