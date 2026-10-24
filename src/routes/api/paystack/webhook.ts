// Paystack webhook → confirm_payment(). Configure in Paystack → Settings → API Keys & Webhooks:
//   https://<your-domain>/api/paystack/webhook
// Only trusts requests whose x-paystack-signature matches HMAC-SHA512(raw body, secret key).
// Always answers 200 once the signature checks out, so Paystack doesn't retry forever on events
// we deliberately ignore; real failures return 500 so Paystack retries.
import { createFileRoute } from "@tanstack/react-router";
import { confirmPayment } from "@/lib/payments.server";
import { verifySignature } from "@/lib/paystack.server";

export const Route = createFileRoute("/api/paystack/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        if (!(await verifySignature(raw, request.headers.get("x-paystack-signature"))))
          return new Response("Invalid signature", { status: 401 });

        const event = JSON.parse(raw) as {
          event: string;
          data?: {
            reference?: string;
            amount?: number;
            currency?: string;
            channel?: string;
            status?: string;
          };
        };
        const d = event.data;
        if (
          event.event !== "charge.success" ||
          !d?.reference ||
          d.status !== "success" ||
          d.currency !== "NGN"
        )
          return new Response("Ignored", { status: 200 });

        try {
          await confirmPayment(d.reference, Number(d.amount), d.channel ?? "paystack", d);
          return new Response("OK", { status: 200 });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          // Not ours (e.g. a payment made on another integration) or a wrong amount: log, don't retry.
          if (/UNKNOWN_REFERENCE|AMOUNT_MISMATCH/.test(msg)) {
            console.error(`[paystack webhook] ${msg}`);
            return new Response("Rejected", { status: 200 });
          }
          console.error("[paystack webhook] confirm failed", e);
          return new Response("Error", { status: 500 });
        }
      },
    },
  },
});
