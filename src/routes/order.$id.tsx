import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Copy, MapPin, MessageCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Fireworks } from "@/components/site/Fireworks";
import { Field, formatDate, inputClass } from "@/components/site/forms";
import { OrderTimeline, StatusPill } from "@/components/site/OrderTimeline";
import { TrackForm } from "@/components/site/TrackForm";
import { Button } from "@/components/ui/button";
import { WHATSAPP_NUMBER } from "@/lib/data";
import { useDb } from "@/lib/mock-db";
import { formatNaira } from "@/lib/pricing";
import { findOrderForTracking } from "@/lib/services";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import type { Order } from "@/lib/types";
import { formatArrives } from "@/lib/db-map";

type Search = { new?: boolean; phone?: string };

export const Route = createFileRoute("/order/$id")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    ...(s["new"] === true || s["new"] === "true" ? { new: true } : {}),
    ...(typeof s["phone"] === "string" ? { phone: s["phone"] } : {}),
  }),
  head: ({ params }) => ({
    meta: [{ title: `Order ${params.id} — Detty Sky` }, { name: "robots", content: "noindex" }],
  }),
  component: OrderPage,
});

function OrderPage() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const { hydrated, orders } = useDb();
  const { orderIds } = useStore();
  const { user } = useAuth();

  if (!hydrated)
    return (
      <div className="mx-auto max-w-4xl px-4 py-24 text-center text-muted-foreground">
        Loading your order…
      </div>
    );

  const order = orders.find((o) => o.id === id);
  // Who may see this order: the browser that placed it, the signed-in owner, or someone who knows the phone number.
  const allowed =
    order &&
    (orderIds.includes(order.id) ||
      (user && user.email.toLowerCase() === order.customer.email.toLowerCase()) ||
      (search.phone && findOrderForTracking(order.id, search.phone)));

  if (!order || !allowed) return <TrackForm initialId={id} notFound={!!search.phone || !order} />;
  return <OrderDetails order={order} celebrate={!!search.new} />;
}

function OrderDetails({ order, celebrate }: { order: Order; celebrate: boolean }) {
  const { user } = useAuth();
  const preorder = order.lines.some((l) => l.preorderArrives);
  const paid = order.payment?.status === "paid";
  return (
    <div>
      {celebrate && (
        <section className="relative overflow-hidden">
          <div className="absolute inset-0">
            <Fireworks intensity={1.8} />
          </div>
          <div className="relative mx-auto max-w-3xl px-4 py-16 text-center">
            <CheckCircle2 className="animate-float-up mx-auto h-14 w-14 text-emerald" />
            <h1 className="animate-float-up mt-4 text-4xl sm:text-5xl">
              Your sky is <span className="text-party-gradient">booked!</span>
            </h1>
            <p className="animate-float-up mt-3 text-muted-foreground">
              Payment received. We've emailed your receipt to{" "}
              <strong className="text-foreground">{order.customer.email}</strong>.
            </p>
          </div>
        </section>
      )}

      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-magenta">Order</p>
            <div className="flex items-center gap-2">
              <h2 className="text-3xl">{order.id}</h2>
              <button
                aria-label="Copy order number"
                className="rounded-full p-2 hover:bg-accent"
                onClick={() => {
                  void navigator.clipboard?.writeText(order.id);
                  toast.success("Order number copied");
                }}
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              Placed {formatDate(order.createdAt)} · Estimated delivery {formatDate(order.eta)}
            </p>
          </div>
          <StatusPill status={order.status} />
        </div>

        {!paid && (
          <div className="mt-6 rounded-2xl border border-ember/50 bg-ember/10 p-4 text-sm">
            <strong>Awaiting payment.</strong> We've sent a Paystack payment link to your
            email/WhatsApp. Your order is confirmed once payment lands.
          </div>
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <section className="glass rounded-3xl p-6" aria-labelledby="track-h">
              <h3 id="track-h" className="mb-6 text-lg">
                Tracking
              </h3>
              <OrderTimeline order={order} />
              {preorder && (
                <p className="mt-6 rounded-xl bg-royal/15 p-3 text-sm">
                  Includes pre-order items — they ship together as soon as stock lands, before New
                  Year's Eve.
                </p>
              )}
            </section>

            <section className="glass rounded-3xl p-6" aria-labelledby="items-h">
              <h3 id="items-h" className="text-lg">
                Items
              </h3>
              <ul className="mt-4 divide-y divide-border text-sm">
                {order.lines.map((l, i) => (
                  <li key={l.productId + i} className="flex justify-between gap-3 py-3">
                    <span>
                      {l.qty} × {l.name}
                      {l.preorderArrives && (
                        <span className="ml-2 text-xs text-gold">
                          Pre-order · {formatArrives(l.preorderArrives)}
                        </span>
                      )}
                    </span>
                    <span className="font-semibold">{formatNaira(l.unitPrice * l.qty)}</span>
                  </li>
                ))}
              </ul>
              <dl className="mt-2 space-y-1.5 border-t border-border pt-3 text-sm">
                <div className="flex justify-between">
                  <dt>Subtotal</dt>
                  <dd>{formatNaira(order.subtotal)}</dd>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between text-emerald">
                    <dt>Bulk discount</dt>
                    <dd>−{formatNaira(order.discount)}</dd>
                  </div>
                )}
                {order.codeDiscount ? (
                  <div className="flex justify-between text-emerald">
                    <dt>Code {order.code}</dt>
                    <dd>−{formatNaira(order.codeDiscount)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <dt>Delivery</dt>
                  <dd>{formatNaira(order.deliveryFee)}</dd>
                </div>
                <div className="flex justify-between font-display text-lg">
                  <dt>Total</dt>
                  <dd className="text-gold">{formatNaira(order.total)}</dd>
                </div>
              </dl>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="glass rounded-3xl p-5 text-sm">
              <h3 className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4 text-gold" /> Delivering to
              </h3>
              <p className="mt-2">
                {order.customer.name}
                <br />
                {order.address.street}
                <br />
                {order.address.city}, {order.address.state}
                <br />
                {order.customer.phone}
              </p>
              {order.payment && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Paystack ref {order.payment.reference} · {order.payment.channel.replace("_", " ")}
                </p>
              )}
            </section>
            {!user && <CreateAccount order={order} />}
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hi Detty Sky! Question about order ${order.id}.`)}`}
              target="_blank"
              rel="noreferrer"
              className="glass flex items-center gap-3 rounded-3xl p-5 text-sm hover:border-whatsapp/60"
            >
              <MessageCircle className="h-6 w-6 text-whatsapp" />{" "}
              <span>
                <strong>Questions?</strong>
                <br />
                <span className="text-muted-foreground">Chat with us on WhatsApp</span>
              </span>
            </a>
            <Button asChild variant="glass" className="w-full">
              <Link to="/shop">Keep shopping</Link>
            </Button>
          </aside>
        </div>
      </div>
    </div>
  );
}

function CreateAccount({ order }: { order: Order }) {
  const { signUp } = useAuth();
  const [pw, setPw] = useState("");
  const [sent, setSent] = useState(false);
  if (sent)
    return (
      <section className="glass rounded-3xl p-5 shadow-glow">
        <h3 className="text-base">Check your inbox 📬</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          We sent a link to {order.customer.email}. Confirm it and this order appears in your account.
        </p>
      </section>
    );
  return (
    <section className="glass rounded-3xl p-5 shadow-glow">
      <h3 className="text-base">Save your details for next time</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Create an account to track orders, save addresses and leave reviews.
      </p>
      <form
        className="mt-4 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (pw.length < 8) {
            toast.error("Use at least 8 characters");
            return;
          }
          const r = await signUp({
            email: order.customer.email,
            password: pw,
            name: order.customer.name,
            phone: order.customer.phone,
          });
          if ("error" in r) toast.error(r.error);
          else if (r.needsConfirmation) setSent(true);
          else toast.success("Account created — welcome to Detty Sky!");
        }}
      >
        <p className="text-xs text-muted-foreground">{order.customer.email}</p>
        <Field label="Choose a password" htmlFor="new-pw">
          <input
            id="new-pw"
            type="password"
            autoComplete="new-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Button type="submit" variant="gold" className="w-full">
          Create account
        </Button>
      </form>
    </section>
  );
}
