// Cloudflare Turnstile verification (server only). https://developers.cloudflare.com/turnstile/
// Off when TURNSTILE_SECRET_KEY is unset (local dev). Set it in production — see LAUNCH.md.
import { getRequestHeader } from "@tanstack/react-start/server";

export async function verifyTurnstile(token: string | undefined): Promise<void> {
  const secret = process.env["TURNSTILE_SECRET_KEY"];
  if (!secret) return;
  if (!token) throw new Error("Please complete the security check.");
  const body = new FormData();
  body.set("secret", secret);
  body.set("response", token);
  const ip = getRequestHeader("cf-connecting-ip");
  if (ip) body.set("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  const out = (await res.json().catch(() => ({}))) as { success?: boolean };
  if (!out.success) throw new Error("The security check failed. Refresh the page and try again.");
}
