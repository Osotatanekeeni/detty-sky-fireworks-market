import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

// Baseline security headers on every response. (No CSP yet: Lovable's scripts, Google Fonts,
// Turnstile and Cloudflare analytics would all need allow-listing — add one deliberately.)
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};
const securityHeadersMiddleware = createMiddleware().server(async ({ next }) => {
  const result = await next();
  const res = (result as { response?: Response }).response ?? result;
  if (res instanceof Response && !res.headers.has("X-Content-Type-Options")) {
    try {
      for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.headers.set(k, v);
    } catch {
      /* immutable headers (e.g. a proxied response) — leave as is */
    }
  }
  return result;
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, securityHeadersMiddleware, csrfMiddleware],
}));
