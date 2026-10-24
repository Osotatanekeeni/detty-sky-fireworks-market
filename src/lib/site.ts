// Public site URL for absolute links in SEO tags (og:image, JSON-LD, sitemap).
// VITE_SITE_URL is set at build time; server routes can also fall back to the request origin.
export const SITE_URL = ((import.meta.env["VITE_SITE_URL"] as string | undefined) ?? "").replace(
  /\/$/,
  "",
);

/** Absolute URL for a path or an already-absolute URL (e.g. R2 media). */
export const absolute = (pathOrUrl: string) =>
  /^https?:\/\//.test(pathOrUrl) ? pathOrUrl : `${SITE_URL}${pathOrUrl}`;
