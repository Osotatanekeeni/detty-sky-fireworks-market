// Paystack API (server only). Amounts are in kobo, same as the database.
// Docs: https://paystack.com/docs/api/transaction/
//
// Local development without Paystack keys: set PAYSTACK_SIMULATE=1. Checkout then "pays"
// instantly through the same verify → confirm_payment path. It is refused in production builds,
// so a missing key can never mean free orders.

const API = "https://api.paystack.co";

function secret(): string | null {
  return process.env["PAYSTACK_SECRET_KEY"] || null;
}

export function simulating(): boolean {
  return !secret() && process.env["PAYSTACK_SIMULATE"] === "1" && !import.meta.env.PROD;
}

function requireSecret(): string {
  const key = secret();
  if (!key) throw new Error("Payments aren't set up yet (PAYSTACK_SECRET_KEY is missing).");
  return key;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requireSecret()}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const body = (await res.json().catch(() => ({}))) as {
    status?: boolean;
    message?: string;
    data?: T;
  };
  if (!res.ok || !body.status) throw new Error(`Paystack: ${body.message ?? res.statusText}`);
  return body.data as T;
}

export async function initializeTransaction(opts: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}): Promise<{ authorizationUrl: string }> {
  if (simulating()) {
    const url = new URL(opts.callbackUrl);
    url.searchParams.set("reference", opts.reference);
    return { authorizationUrl: url.toString() };
  }
  const data = await call<{ authorization_url: string }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: opts.email,
      amount: opts.amountKobo,
      currency: "NGN",
      reference: opts.reference,
      callback_url: opts.callbackUrl,
      channels: ["card", "bank_transfer", "ussd", "bank"],
      metadata: opts.metadata,
    }),
  });
  return { authorizationUrl: data.authorization_url };
}

export interface VerifiedTransaction {
  status: string; // "success" | "failed" | "abandoned" | ...
  reference: string;
  amountKobo: number;
  currency: string;
  channel: string;
  raw: unknown;
}

export async function verifyTransaction(
  reference: string,
  expectedKobo: number,
): Promise<VerifiedTransaction> {
  if (simulating())
    return {
      status: "success",
      reference,
      amountKobo: expectedKobo,
      currency: "NGN",
      channel: "simulated",
      raw: { simulated: true },
    };
  const data = await call<{
    status: string;
    reference: string;
    amount: number;
    currency: string;
    channel: string;
  }>(`/transaction/verify/${encodeURIComponent(reference)}`);
  return {
    status: data.status,
    reference: data.reference,
    amountKobo: data.amount,
    currency: data.currency,
    channel: data.channel,
    raw: data,
  };
}

/** x-paystack-signature = HMAC-SHA512(raw body, secret key), hex. Constant-time compare. */
export async function verifySignature(rawBody: string, signature: string | null): Promise<boolean> {
  const key = secret();
  if (!key || !signature) return false;
  const k = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(
    await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(rawBody)),
  );
  const expected = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++)
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}
