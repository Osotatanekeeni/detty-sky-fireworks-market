// /robots.txt — keeps private pages out of search and points crawlers at the sitemap.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const base = (process.env["SITE_URL"] || new URL(request.url).origin).replace(/\/$/, "");
        const body = [
          "User-agent: *",
          "Allow: /",
          "Disallow: /admin",
          "Disallow: /account",
          "Disallow: /checkout",
          "Disallow: /cart",
          "Disallow: /order/",
          "Disallow: /api/",
          "",
          `Sitemap: ${base}/sitemap.xml`,
          "",
        ].join("\n");
        return new Response(body, {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
