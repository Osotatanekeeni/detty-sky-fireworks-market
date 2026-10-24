// Seeds the catalogue (products, bundles, banners) from src/lib/data.ts into Supabase.
//
//   npx bun scripts/seed-products.ts > /tmp/seed-products.sql
//   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f /tmp/seed-products.sql
//
// Run it AFTER the migration and supabase/seed.sql. Safe to re-run: products and bundles are
// upserted by slug, and their occasions/media/tiers/items are replaced.
//
// Deliberately NOT seeded: the mock reviews and orders (fake "verified purchases" have no place
// in the real store) and the mock category kill-switch rows (set real ones in admin).
// Images point at /images/products/* in public/ until Phase 3 moves media to Cloudflare R2.
import { BANNERS, BUNDLES, PRODUCTS } from "../src/lib/data";
import { toKobo } from "../src/lib/db-map";

const q = (v: string | null | undefined) => (v == null ? "null" : `'${v.replace(/'/g, "''")}'`);
const arr = (xs: string[]) => `array[${xs.map(q).join(", ")}]::text[]`;
/** Vite turns asset imports into URLs; Bun gives a file path. Either way, keep the file name. */
const img = (src: string) => {
  const file = src.split("/").pop()!; // "p-cake.jpg" (Bun) or "p-cake-DEDNMAFX.jpg" (Vite)
  return `/images/products/${file.replace(/^(p-[a-z]+)-[\w-]{8}(\.\w+)$/, "$1$2")}`;
};

const out: string[] = ["begin;"];

for (const p of PRODUCTS) {
  out.push(`
insert into public.products (slug, name, category_slug, description, price_kobo, compare_at_kobo, duration_sec, shots, height_m, noise, colours, stock, low_stock_threshold, preorder_arrives, best_seller)
values (${q(p.slug)}, ${q(p.name)}, ${q(p.category)}, ${q(p.description)}, ${toKobo(p.price)}, ${p.compareAt ? toKobo(p.compareAt) : "null"}, ${p.durationSec}, ${p.shots}, ${p.heightM}, ${q(p.noise)}, ${arr(p.colours)}, ${p.stock}, ${p.lowStockThreshold}, ${q(p.preorder?.arrives)}, ${!!p.bestSeller})
on conflict (slug) do update set name = excluded.name, category_slug = excluded.category_slug, description = excluded.description,
  price_kobo = excluded.price_kobo, compare_at_kobo = excluded.compare_at_kobo, duration_sec = excluded.duration_sec, shots = excluded.shots,
  height_m = excluded.height_m, noise = excluded.noise, colours = excluded.colours, stock = excluded.stock,
  low_stock_threshold = excluded.low_stock_threshold, preorder_arrives = excluded.preorder_arrives, best_seller = excluded.best_seller;`);
  const id = `(select id from public.products where slug = ${q(p.slug)})`;
  out.push(`delete from public.product_occasions where product_id = ${id};`);
  for (const o of p.occasions)
    out.push(
      `insert into public.product_occasions (product_id, occasion_slug) values (${id}, ${q(o)});`,
    );
  out.push(`delete from public.product_media where product_id = ${id};`);
  p.gallery.forEach((src, i) =>
    out.push(
      `insert into public.product_media (product_id, kind, url, sort) values (${id}, 'image', ${q(img(src))}, ${i});`,
    ),
  );
  out.push(`delete from public.price_tiers where product_id = ${id};`);
  for (const t of p.tiers)
    out.push(
      `insert into public.price_tiers (product_id, min_qty, discount_pct) values (${id}, ${t.minQty}, ${t.discountPct});`,
    );
}

const slugOf = (productId: string) => PRODUCTS.find((p) => p.id === productId)!.slug;
for (const b of BUNDLES) {
  out.push(`
insert into public.bundles (slug, name, tagline, image_url, price_kobo)
values (${q(b.slug)}, ${q(b.name)}, ${q(b.tagline)}, ${q(img(b.image))}, ${toKobo(b.price)})
on conflict (slug) do update set name = excluded.name, tagline = excluded.tagline, image_url = excluded.image_url, price_kobo = excluded.price_kobo;`);
  const id = `(select id from public.bundles where slug = ${q(b.slug)})`;
  out.push(`delete from public.bundle_items where bundle_id = ${id};`);
  for (const i of b.items)
    out.push(
      `insert into public.bundle_items (bundle_id, product_id, qty) values (${id}, (select id from public.products where slug = ${q(slugOf(i.productId))}), ${i.qty});`,
    );
}

// Banners have no natural key, so only seed them into an empty table.
out.push(`
insert into public.banners (title, subtitle, cta, href, tone, active, sort)
select * from (values
${BANNERS.map((b, i) => `  (${q(b.title)}, ${q(b.subtitle)}, ${q(b.cta)}, ${q(b.href)}, ${q(b.tone)}, ${b.active}, ${i})`).join(",\n")}
) v where not exists (select 1 from public.banners);`);

out.push("commit;");
console.log(out.join("\n"));
