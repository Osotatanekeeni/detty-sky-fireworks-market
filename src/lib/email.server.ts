// Transactional email via Resend (server only). Best-effort: a failed email is logged and never
// fails the payment, status change or quote reply that triggered it.
// Without RESEND_API_KEY, emails are logged instead of sent (handy in development).
import { formatArrives } from "./db-map";
import { formatNaira } from "./pricing";
import type { Order, OrderStatus } from "./types";

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

function siteUrl() {
  return (process.env["SITE_URL"] || "http://localhost:8080").replace(/\/$/, "");
}

async function send(to: string, subject: string, html: string) {
  if (!to) return;
  const key = process.env["RESEND_API_KEY"];
  if (!key) {
    console.info(`[email skipped — no RESEND_API_KEY] to=${to} subject="${subject}"`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env["EMAIL_FROM"] || "Detty Sky <orders@dettysky.ng>",
        to: [to],
        subject,
        html,
      }),
    });
    if (!res.ok) console.error(`[email] Resend ${res.status}: ${await res.text()}`);
  } catch (e) {
    console.error("[email] send failed", e);
  }
}

function layout(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#0d0e1f;font-family:Arial,sans-serif;color:#f4f1ea">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
<p style="font-size:20px;font-weight:bold;margin:0 0 24px">Detty<span style="color:#f5c84c">Sky</span></p>
<h1 style="font-size:22px;margin:0 0 12px">${title}</h1>
${body}
<p style="margin-top:32px;font-size:12px;color:#9a97a8">Please use fireworks responsibly. Adults 18+ only.<br>Detty Sky · Port Harcourt</p>
</div></body></html>`;
}

const button = (href: string, label: string) =>
  `<p style="margin:24px 0"><a href="${href}" style="background:#f5c84c;color:#0d0e1f;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:bold">${label}</a></p>`;

export function sendReceipt(o: Order) {
  const rows = o.lines
    .map(
      (l) =>
        `<tr><td style="padding:6px 0">${l.qty} × ${esc(l.name)}${l.preorderArrives ? ` <span style="color:#f5c84c">(pre-order, arrives ${formatArrives(l.preorderArrives)})</span>` : ""}</td><td style="text-align:right">${formatNaira(l.unitPrice * l.qty)}</td></tr>`,
    )
    .join("");
  const money = (label: string, v: number) =>
    `<tr><td style="padding:4px 0;color:#9a97a8">${label}</td><td style="text-align:right">${formatNaira(v)}</td></tr>`;
  const html = layout(
    `Your sky is booked, ${esc(o.customer.name.split(" ")[0] ?? "")}! 🎆`,
    `<p>We've received your payment for order <strong>${o.id}</strong> and we're packing it now.</p>
<table style="width:100%;border-collapse:collapse;font-size:14px">${rows}
${money("Subtotal", o.subtotal)}${o.discount ? money("Bulk discount", -o.discount) : ""}${o.codeDiscount ? money(`Code ${esc(o.code ?? "")}`, -o.codeDiscount) : ""}${money("Delivery", o.deliveryFee)}
<tr><td style="padding:8px 0;font-weight:bold">Total paid</td><td style="text-align:right;font-weight:bold;color:#f5c84c">${formatNaira(o.total)}</td></tr></table>
<p>Delivering to ${esc(o.address.street)}, ${esc(o.address.city)}, ${esc(o.address.state)}${o.eta ? ` — expected by <strong>${esc(o.eta)}</strong>` : ""}.</p>
${button(`${siteUrl()}/track`, "Track your order")}
<p style="font-size:13px;color:#9a97a8">Track with your order number ${o.id} and the phone number you used at checkout.</p>`,
  );
  return send(o.customer.email, `Order ${o.id} confirmed — Detty Sky`, html);
}

const STATUS_COPY: Partial<Record<OrderStatus, string>> = {
  Dispatched: "Your order has left our Port Harcourt store.",
  "Out for Delivery": "A rider is on the way to you today. Keep your phone close!",
  Delivered: "Your order has been delivered. Enjoy the show — and light responsibly!",
};

export function sendStatusUpdate(o: Order) {
  const line = STATUS_COPY[o.status];
  if (!line) return Promise.resolve();
  const extra =
    o.status === "Delivered"
      ? `<p>Got a minute? Leave a review from your account — it helps other buyers choose.</p>${button(`${siteUrl()}/account?tab=reviews`, "Write a review")}`
      : button(`${siteUrl()}/track`, "Track your order");
  return send(
    o.customer.email,
    `Order ${o.id}: ${o.status}`,
    layout(`${o.status} 🚚`, `<p>${line}</p><p>Order <strong>${o.id}</strong>.</p>${extra}`),
  );
}

export function sendQuoteReply(q: {
  name: string;
  email?: string | undefined;
  request: string;
  response: string;
  amount?: number | undefined;
  paymentUrl?: string | undefined;
}) {
  if (!q.email) return Promise.resolve();
  return send(
    q.email,
    "Your Detty Sky bulk quote",
    layout(
      `Hi ${esc(q.name.split(" ")[0] ?? "")}, here's your quote`,
      `<p style="color:#9a97a8">You asked for: ${esc(q.request)}</p>
<p style="white-space:pre-line">${esc(q.response)}</p>
${q.amount ? `<p style="font-size:18px">Total: <strong style="color:#f5c84c">${formatNaira(q.amount)}</strong></p>` : ""}
${q.paymentUrl ? button(q.paymentUrl, "Pay securely with Paystack") : "<p>Reply to this email or chat with us on WhatsApp to go ahead.</p>"}`,
    ),
  );
}
