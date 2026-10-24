// /sitemap.xml — every public page plus each active product, from the live catalogue.
import { createFileRoute } from "@tanstack/react-router";
import { fetchCatalogue } from "@/lib/catalogue.server";
import { supabasePublic } from "@/lib/supabase.server";

const STATIC = ["/", "/shop", "/bundles", "/bulk", "/delivery", "/track"];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const base = (process.env["SITE_URL"] || new URL(request.url).origin).replace(/\/$/, "");
        const abs = (u: string) => (u.startsWith("http") ? u : base + u);
        const { products } = await fetchCatalogue(supabasePublic());
        const urls = [
          ...STATIC.map((p) => `<url><loc>${base}${p}</loc></url>`),
          ...products.map(
            (p) =>
              `<url><loc>${base}/product/${p.slug}</loc>${p.image ? `<image:image><image:loc>${abs(p.image)}</image:loc></image:image>` : ""}</url>`,
          ),
        ];
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join("\n")}
</urlset>`;
        return new Response(xml, {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
