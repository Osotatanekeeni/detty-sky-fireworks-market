// Confirming payments and loading orders with the service-role client (server only).
import { ORDER_SELECT, orderFromRow, type OrderRow } from "./db-map";
import { sendReceipt } from "./email.server";
import { verifyTransaction } from "./paystack.server";
import { supabaseService } from "./supabase.server";
import type { Order } from "./types";

export async function loadOrder(match: { id: string } | { number: string }, limited = false) {
  const q = supabaseService().from("orders").select(ORDER_SELECT);
  const { data, error } = await (
    "id" in match ? q.eq("id", match.id) : q.eq("number", match.number)
  ).maybeSingle();
  if (error) throw new Error(`Loading order failed: ${error.message}`);
  return data ? orderFromRow(data as unknown as OrderRow, limited) : null;
}

/**
 * Marks the order for `reference` paid via confirm_payment() (idempotent, checks the amount) and
 * sends the receipt exactly once, even when the webhook and the callback page race.
 */
export async function confirmPayment(
  reference: string,
  amountKobo: number,
  channel: string,
  raw: unknown,
) {
  const db = supabaseService();
  const { data, error } = await db.rpc("confirm_payment", {
    p_reference: reference,
    p_amount_kobo: amountKobo,
    p_channel: channel,
    p_raw: raw ?? {},
  });
  if (error) throw new Error(error.message);
  const orderId = (data as { id: string }).id;
  // First caller to flip the flag sends the receipt.
  const { data: claimed } = await db
    .from("payments")
    .update({ raw: { ...(raw as object), receipt_sent: true } })
    .eq("reference", reference)
    .eq("status", "paid")
    .or("raw->>receipt_sent.is.null,raw->>receipt_sent.neq.true")
    .select("id");
  const order = await loadOrder({ id: orderId });
  if (order && claimed?.length) await sendReceipt(order);
  return order as Order;
}

/** Server-side verification for the callback page: ask Paystack, then confirm. */
export async function verifyAndConfirm(reference: string): Promise<Order | null> {
  const db = supabaseService();
  const { data: pay } = await db
    .from("payments")
    .select("status, amount_kobo, order_id")
    .eq("reference", reference)
    .maybeSingle();
  if (!pay) return null;
  if (pay.status === "paid") return loadOrder({ id: pay.order_id });
  const tx = await verifyTransaction(reference, Number(pay.amount_kobo));
  if (tx.status !== "success" || tx.currency !== "NGN") return loadOrder({ id: pay.order_id });
  return confirmPayment(reference, tx.amountKobo, tx.channel, tx.raw);
}
