import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { orderFromRow, type OrderRow } from "@/lib/db-map";
import { verifySignature } from "@/lib/paystack.server";

const KEY = "sk_test_unit";
afterEach(() => {
  delete process.env["PAYSTACK_SECRET_KEY"];
});

describe("verifySignature", () => {
  const body = JSON.stringify({ event: "charge.success", data: { reference: "R1", amount: 100 } });
  const sig = createHmac("sha512", KEY).update(body).digest("hex");

  it("accepts Paystack's HMAC-SHA512 of the raw body", async () => {
    process.env["PAYSTACK_SECRET_KEY"] = KEY;
    expect(await verifySignature(body, sig)).toBe(true);
  });
  it("rejects a tampered body, a wrong signature, or no secret", async () => {
    process.env["PAYSTACK_SECRET_KEY"] = KEY;
    expect(await verifySignature(body.replace("100", "1"), sig)).toBe(false);
    expect(await verifySignature(body, sig.replace(/^./, "0"))).toBe(false);
    expect(await verifySignature(body, null)).toBe(false);
    delete process.env["PAYSTACK_SECRET_KEY"];
    expect(await verifySignature(body, sig)).toBe(false);
  });
});

const row: OrderRow = {
  id: "o1",
  number: "DS-10300",
  email: "ada@example.test",
  customer_name: "Ada Test",
  phone: "08031234567",
  state: "Rivers",
  city: "Port Harcourt",
  street: "12 Aba Road",
  status: "dispatched",
  subtotal_kobo: 50_400_000,
  bulk_discount_kobo: 2_520_000,
  code: "DETTY10",
  code_discount_kobo: 4_788_000,
  delivery_fee_kobo: 250_000,
  total_kobo: 43_342_000,
  eta: "2026-12-02",
  quote_id: null,
  note: "",
  created_at: "2026-12-01T09:00:00Z",
  order_items: [
    {
      id: "i1",
      kind: "product",
      product_id: "p1",
      bundle_id: null,
      name: "Crossover King 49",
      qty: 12,
      unit_price_kobo: 3_990_000,
      line_total_kobo: 47_880_000,
      preorder_arrives: null,
    },
  ],
  order_status_events: [
    { status: "processing", created_at: "2026-12-01T09:01:00Z" },
    { status: "pending_payment", created_at: "2026-12-01T09:00:00Z" },
    { status: "dispatched", created_at: "2026-12-01T12:00:00Z" },
  ],
  payments: [
    { provider: "paystack", reference: "OLD", channel: null, status: "pending", created_at: "2026-12-01T09:00:00Z", paid_at: null },
    { provider: "paystack", reference: "PAID", channel: "card", status: "paid", created_at: "2026-12-01T08:00:00Z", paid_at: "2026-12-01T09:01:00Z" },
  ],
};

describe("orderFromRow", () => {
  it("maps money, status, history and the paid payment", () => {
    const o = orderFromRow(row);
    expect(o.id).toBe("DS-10300");
    expect(o.total).toBe(433_420);
    expect(o.codeDiscount).toBe(47_880);
    expect(o.status).toBe("Dispatched");
    expect(o.history.map((h) => h.status)).toEqual(["Awaiting payment", "Processing", "Dispatched"]);
    expect(o.payment?.reference).toBe("PAID");
    expect(o.lines[0]).toMatchObject({ itemId: "i1", unitPrice: 39_900, qty: 12 });
  });
  it("hides contact details in the limited (phone-tracking) view", () => {
    const o = orderFromRow(row, true);
    expect(o.customer.email).toBe("");
    expect(o.address.street).toBe("");
    expect(o.customer.phone).toBe("••• 4567");
    expect(o.payment?.reference).toBe("");
    expect(o.limited).toBe(true);
  });
});
