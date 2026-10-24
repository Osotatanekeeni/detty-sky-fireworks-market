import cake from "@/assets/p-cake.jpg";
import rocket from "@/assets/p-rocket.jpg";
import sparkler from "@/assets/p-sparkler.jpg";
import smoke from "@/assets/p-smoke.jpg";
import { DEFAULT_TIERS } from "./pricing";
import type {
  Banner, Bundle, BulkQuote, Campaign, Category, CategorySlug, DeliveryZone, DiscountCode, NoiseLevel, Occasion,
  OccasionSlug, Order, Product, Review, StateName,
} from "./types";

export const STATES: StateName[] = ["Akwa Ibom", "Bayelsa", "Cross River", "Delta", "Edo", "Rivers"];

export const CATEGORIES: Category[] = [
  { slug: "aerial-cakes", name: "Aerial Cakes", blurb: "One light, endless sky" },
  { slug: "rockets", name: "Rockets", blurb: "Straight to the clouds" },
  { slug: "fountains", name: "Fountains", blurb: "Golden ground showers" },
  { slug: "sparklers", name: "Sparklers", blurb: "Handheld magic" },
  { slug: "smoke-colour", name: "Smoke & Colour", blurb: "Photo-ready clouds" },
  { slug: "confetti-cannons", name: "Confetti Cannons", blurb: "Pop the moment" },
  { slug: "wedding-party", name: "Wedding & Party Effects", blurb: "Grand entrances" },
];

export const OCCASIONS: Occasion[] = [
  { slug: "christmas", name: "Christmas", blurb: "Make your December detty" },
  { slug: "new-year", name: "New Year Countdown", blurb: "3, 2, 1… light am!" },
  { slug: "wedding-entrance", name: "Wedding Entrance", blurb: "Make the grand entrance" },
  { slug: "birthday", name: "Birthday", blurb: "Another year, more sparkle" },
  { slug: "church-crossover", name: "Church Crossover Night", blurb: "Cross over in glory" },
];

const IMG: Record<CategorySlug, string> = {
  "aerial-cakes": cake, rockets: rocket, fountains: sparkler, sparklers: sparkler,
  "smoke-colour": smoke, "confetti-cannons": smoke, "wedding-party": smoke,
};

type Raw = [string, CategorySlug, OccasionSlug[], number, number, number, number, NoiseLevel, string[], number, (string | undefined)?, boolean?];

const RAW: Raw[] = [
  ["Royal Crown 100", "aerial-cakes", ["new-year", "church-crossover"], 85000, 60, 100, 40, "Loud", ["Gold", "Magenta"], 18, "2026-12-20", true],
  ["Crossover King 49", "aerial-cakes", ["wedding-entrance", "birthday"], 42000, 35, 49, 30, "Loud", ["Gold", "Emerald"], 24, undefined, true],
  ["Lagoon Lights 25", "aerial-cakes", ["christmas", "birthday"], 22500, 25, 25, 25, "Medium", ["Purple", "Silver"], 40],
  ["Midnight Thunder 150", "aerial-cakes", ["new-year"], 135000, 90, 150, 45, "Loud", ["Red", "Gold", "Blue"], 6, "2026-12-22"],
  ["Calabar Carnival 36", "aerial-cakes", ["christmas", "new-year"], 36000, 30, 36, 30, "Medium", ["Orange", "Green"], 30],
  ["Sky Blast Rockets (5)", "rockets", ["new-year", "christmas"], 12000, 8, 5, 50, "Loud", ["Gold", "Red"], 80, undefined, true],
  ["Delta Comet Rockets (12)", "rockets", ["new-year", "church-crossover"], 26500, 10, 12, 60, "Loud", ["Blue", "Silver"], 4],
  ["Whistling Eagle (10)", "rockets", ["birthday"], 15000, 6, 10, 40, "Loud", ["Green"], 55],
  ["Golden Rain Fountain", "fountains", ["wedding-entrance", "christmas"], 9500, 45, 1, 4, "Quiet", ["Gold"], 120, undefined, true],
  ["Niger Delta Volcano", "fountains", ["new-year", "birthday"], 14500, 60, 1, 6, "Medium", ["Gold", "Red"], 60],
  ["Silver Waterfall Fountain", "fountains", ["wedding-entrance"], 18000, 40, 1, 3, "Quiet", ["Silver"], 9],
  ["Gold Sparklers 36cm (10)", "sparklers", ["wedding-entrance", "birthday", "christmas"], 3500, 90, 0, 0, "Quiet", ["Gold"], 400, undefined, true],
  ["Heart Sparklers (6)", "sparklers", ["wedding-entrance"], 4800, 60, 0, 0, "Quiet", ["Gold"], 150],
  ["Number Sparklers 0-9", "sparklers", ["birthday"], 2500, 45, 0, 0, "Quiet", ["Gold"], 220],
  ["Rainbow Smoke Bombs (5)", "smoke-colour", ["wedding-entrance", "birthday"], 11000, 60, 0, 0, "Quiet", ["Magenta", "Orange", "Green", "Purple"], 90, undefined, true],
  ["Gender Reveal Smoke", "smoke-colour", ["birthday"], 6500, 45, 0, 0, "Quiet", ["Pink", "Blue"], 35],
  ["Emerald Haze Grenade", "smoke-colour", ["christmas"], 4500, 50, 0, 0, "Quiet", ["Green"], 7],
  ["Gold Foil Confetti Cannon 60cm", "confetti-cannons", ["wedding-entrance", "new-year"], 7500, 2, 1, 8, "Medium", ["Gold"], 140],
  ["Naira Rain Cannon", "confetti-cannons", ["wedding-entrance", "birthday"], 8500, 2, 1, 8, "Medium", ["Green", "Gold"], 75, undefined, true],
  ["Cold Spark Stage Machine (rental pack)", "wedding-party", ["wedding-entrance"], 120000, 600, 1, 5, "Quiet", ["Gold"], 5, "2026-12-18"],
  ["Grand Entrance Pyro Line", "wedding-party", ["wedding-entrance", "church-crossover"], 55000, 20, 12, 3, "Medium", ["Gold", "Silver"], 14],
  ["Crossover Glory Mega Pack", "wedding-party", ["church-crossover", "new-year"], 95000, 120, 200, 35, "Loud", ["Gold", "Red", "Green"], 10, "2026-12-28"],
];

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const PRODUCTS: Product[] = RAW.map((r, i) => {
  const [name, category, occasions, price, durationSec, shots, heightM, noise, colours, stock, pre, best] = r;
  const img = IMG[category];
  const others = Object.values(IMG).filter((x) => x !== img);
  return {
    id: `p${i + 1}`,
    slug: slugify(name),
    name, category, occasions, price, durationSec, shots, heightM, noise, colours, stock,
    ...(i % 4 === 0 ? { compareAt: Math.round((price * 1.15) / 500) * 500 } : {}),
    image: img,
    gallery: [img, ...Array.from(new Set(others)).slice(0, 2)],
    videoPoster: img,
    description: `${name} delivers ${shots > 0 ? `${shots} shots of ` : ""}${colours.join(", ").toLowerCase()} brilliance${durationSec ? ` over about ${durationSec} seconds` : ""}. Built for South-South celebrations, packed safely and delivered to your door.`,
    lowStockThreshold: 10,
    tiers: DEFAULT_TIERS,
    ...(pre ? { preorder: { arrives: pre } } : {}),
    ...(best ? { bestSeller: true } : {}),
  };
});

const pid = (slug: string) => PRODUCTS.find((p) => p.slug === slug)!.id;
export const BUNDLES: Bundle[] = [
  { id: "b1", slug: "new-year-countdown-pack", name: "New Year Countdown Pack", tagline: "Everything for midnight", image: cake,
    items: [{ productId: pid("royal-crown-100"), qty: 1 }, { productId: pid("sky-blast-rockets-5"), qty: 2 }, { productId: pid("gold-sparklers-36cm-10"), qty: 3 }], price: 105000 },
  { id: "b2", slug: "christmas-party-pack", name: "Christmas Party Pack", tagline: "Colour for the Christmas compound", image: smoke,
    items: [{ productId: pid("rainbow-smoke-bombs-5"), qty: 2 }, { productId: pid("naira-rain-cannon"), qty: 4 }, { productId: pid("golden-rain-fountain"), qty: 2 }], price: 69000 },
  { id: "b3", slug: "birthday-glow-pack", name: "Birthday Glow Pack", tagline: "Blow candles, then the sky", image: sparkler,
    items: [{ productId: pid("number-sparklers-0-9"), qty: 2 }, { productId: pid("lagoon-lights-25"), qty: 1 }, { productId: pid("gold-foil-confetti-cannon-60cm"), qty: 2 }], price: 38000 },
  { id: "b4", slug: "crossover-church-pack", name: "Church Crossover Pack", tagline: "For the whole congregation", image: rocket,
    items: [{ productId: pid("midnight-thunder-150"), qty: 1 }, { productId: pid("delta-comet-rockets-12"), qty: 2 }, { productId: pid("gold-sparklers-36cm-10"), qty: 10 }], price: 195000 },
];

export const DELIVERY_ZONES: DeliveryZone[] = [
  { state: "Rivers", cities: [{ name: "Port Harcourt", fee: 2500, days: 1 }, { name: "Obio/Akpor", fee: 2500, days: 1 }, { name: "Bonny", fee: 7000, days: 4 }, { name: "Eleme", fee: 3500, days: 2 }] },
  { state: "Akwa Ibom", cities: [{ name: "Uyo", fee: 3500, days: 2 }, { name: "Eket", fee: 4500, days: 3 }, { name: "Ikot Ekpene", fee: 4500, days: 3 }] },
  { state: "Bayelsa", cities: [{ name: "Yenagoa", fee: 4000, days: 2 }, { name: "Brass", fee: 8000, days: 5 }, { name: "Ogbia", fee: 5000, days: 3 }] },
  { state: "Cross River", cities: [{ name: "Calabar", fee: 4500, days: 2 }, { name: "Ikom", fee: 6000, days: 4 }, { name: "Ogoja", fee: 6500, days: 4 }] },
  { state: "Delta", cities: [{ name: "Warri", fee: 4000, days: 2 }, { name: "Asaba", fee: 4500, days: 2 }, { name: "Sapele", fee: 5000, days: 3 }, { name: "Ughelli", fee: 5000, days: 3 }] },
  { state: "Edo", cities: [{ name: "Benin City", fee: 4500, days: 2 }, { name: "Auchi", fee: 6000, days: 4 }, { name: "Ekpoma", fee: 5500, days: 3 }] },
];

// Category × state kill switch: true = disabled
export const CATEGORY_STATE_BLOCKS: Partial<Record<StateName, CategorySlug[]>> = {
  Bayelsa: ["rockets"],
};

export const DISCOUNT_CODES: DiscountCode[] = [
  { code: "DETTY10", pct: 10, active: true, uses: 142 },
  { code: "XMAS5", pct: 5, active: true, uses: 61 },
  { code: "XMAS2025", pct: 15, active: false, uses: 380 },
];

export const WHATSAPP_NUMBER = "2348000000000";

export const BANNERS: Banner[] = [
  { id: "bn1", title: "Crossover pre-orders are open", subtitle: "Lock in your church and family stock before December prices climb.", cta: "Shop pre-orders", href: "/shop?preorder=true", tone: "royal", active: true },
  { id: "bn2", title: "Christmas in the compound? We dey for you", subtitle: "Sparklers, smoke and cold sparks for Christmas Day and Boxing Day.", cta: "Christmas effects", href: "/shop?occasion=christmas", tone: "party", active: true },
  { id: "bn3", title: "Buying for a church or event?", subtitle: "Get a custom bulk quote within 24 hours.", cta: "Request a quote", href: "/bulk", tone: "gold", active: false },
];

export const CAMPAIGN: Campaign = {
  announcement: "December pre-orders are open — secure your crossover stock",
  preordersOpen: true,
  countdownLabel: "Countdown to New Year · pre-orders close soon",
};


/** Images an admin can pick for a product or bundle until real uploads (Cloudflare R2) are wired
 *  up. Stable public paths (public/images/products), so they're safe to store in the database. */
export const STOCK_IMAGES = [
  { label: "Aerial cake", src: "/images/products/p-cake.jpg" },
  { label: "Rocket", src: "/images/products/p-rocket.jpg" },
  { label: "Sparkler", src: "/images/products/p-sparkler.jpg" },
  { label: "Smoke", src: "/images/products/p-smoke.jpg" },
];
