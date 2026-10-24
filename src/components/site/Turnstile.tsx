// Cloudflare Turnstile widget. Renders nothing (and reports no token) when
// VITE_TURNSTILE_SITE_KEY is unset — the server skips verification in that case too.
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
  }
}

export const TURNSTILE_SITE_KEY = import.meta.env["VITE_TURNSTILE_SITE_KEY"] as string | undefined;
const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let loading: Promise<void> | undefined;
function loadScript() {
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Turnstile failed to load"));
    document.head.appendChild(s);
  });
  return loading;
}

/** `onToken("")` when the token expires; call `resetKey` changes to get a fresh token after use. */
export function Turnstile({
  onToken,
  resetKey = 0,
  action,
}: {
  onToken: (token: string) => void;
  resetKey?: number;
  action?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useRef<string | undefined>(undefined);
  const cb = useRef(onToken);
  cb.current = onToken;

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !ref.current) return;
    let alive = true;
    void loadScript().then(() => {
      if (!alive || !ref.current || !window.turnstile) return;
      id.current = window.turnstile.render(ref.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: "dark",
        ...(action ? { action } : {}),
        callback: (t: string) => cb.current(t),
        "expired-callback": () => cb.current(""),
        "error-callback": () => cb.current(""),
      });
    });
    return () => {
      alive = false;
      if (id.current) window.turnstile?.remove(id.current);
      id.current = undefined;
    };
  }, [action]);

  useEffect(() => {
    if (resetKey && id.current) {
      cb.current("");
      window.turnstile?.reset(id.current);
    }
  }, [resetKey]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={ref} className="min-h-[65px]" />;
}

/** True when the form may submit: no Turnstile configured, or a token is present. */
export const turnstileReady = (token: string) => !TURNSTILE_SITE_KEY || !!token;
