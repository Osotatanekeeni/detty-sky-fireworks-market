import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Mail } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/admin/ui";
import { formatDate, formatDateTime } from "@/components/site/forms";
import { ORDER_STEPS, StatusPill } from "@/components/site/OrderTimeline";
import { Button } from "@/components/ui/button";
import { markOrderPaid, updateOrderStatus } from "@/lib/actions";
import { useDb } from "@/lib/mock-db";
import { formatNaira } from "@/lib/pricing";
import { formatArrives } from "@/lib/db-map";

export const Route = createFileRoute("/admin/orders/$id")({ component: OrderDetail });

function OrderDetail() {
  const { id } = Route.useParams();
  const { orders } = useDb();
  const o = orders.find((x) => x.id === id);
  if (!o)
    return (
      <p className="text-muted-foreground">
        Order {id} not found.{" "}
        <Link to="/admin/orders" className="text-gold underline">
          Back to orders
        </Link>
      </p>
    );
  const current = ORDER_STEPS.findIndex((s) => s.status === o.status);
  const next = ORDER_STEPS[current + 1];
  const unpaid = o.payment?.status === "pending";

  return (
    <div>
      <Link
        to="/admin/orders"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-gold"
      >
        <ArrowLeft className="h-4 w-4" /> Orders
      </Link>
      <PageHeader
        title={o.id}
        description={`Placed ${formatDateTime(o.createdAt)} · ETA ${formatDate(o.eta)}`}
        actions={<StatusPill status={o.status} />}
      />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Panel title="Delivery status">
            <ol className="grid gap-2 sm:grid-cols-4">
              {ORDER_STEPS.map((s, i) => {
                const at = o.history.find((h) => h.status === s.status)?.at;
                return (
                  <li
                    key={s.status}
                    className={`rounded-xl border p-3 text-sm ${i <= current ? "border-gold/50 bg-gold/10" : "border-border"}`}
                  >
                    <p className="flex items-center gap-1.5 font-semibold">
                      {i <= current && <Check className="h-3.5 w-3.5 text-gold" />}
                      {s.label}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {at ? formatDateTime(at) : "—"}
                    </p>
                  </li>
                );
              })}
            </ol>
            {unpaid && (
              <p className="mt-4 rounded-lg bg-ember/10 p-3 text-sm text-ember">
                Payment pending — don't dispatch until Paystack confirms payment.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {next ? (
                <Button
                  variant="gold"
                  disabled={unpaid}
                  onClick={() => {
                    updateOrderStatus(o.id, next.status);
                    toast.success(`Marked ${next.label}`, {
                      description: `Email sent to ${o.customer.email || "customer"} (demo)`,
                      icon: <Mail className="h-4 w-4" />,
                    });
                  }}
                >
                  Mark as {next.label.toLowerCase()}
                </Button>
              ) : (
                <p className="text-sm text-emerald">Delivered — all done.</p>
              )}
              {unpaid && (
                <Button
                  variant="glass"
                  onClick={() => {
                    markOrderPaid(o.id);
                    toast.success("Marked as paid");
                  }}
                >
                  Mark as paid (bank confirmation)
                </Button>
              )}
            </div>
          </Panel>

          <Panel title="Items">
            <ul className="divide-y divide-border text-sm">
              {o.lines.map((l, i) => (
                <li key={l.productId + i} className="flex justify-between gap-3 py-2.5">
                  <span>
                    {l.qty} × {l.name}
                    {l.kind === "bundle" && (
                      <span className="ml-2 rounded bg-secondary px-1.5 text-[10px] uppercase">
                        Bundle
                      </span>
                    )}
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
            <dl className="mt-2 space-y-1 border-t border-border pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>{formatNaira(o.subtotal)}</dd>
              </div>
              {o.discount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Bulk discount</dt>
                  <dd>−{formatNaira(o.discount)}</dd>
                </div>
              )}
              {o.codeDiscount ? (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Code {o.code}</dt>
                  <dd>−{formatNaira(o.codeDiscount)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Delivery</dt>
                <dd>{formatNaira(o.deliveryFee)}</dd>
              </div>
              <div className="flex justify-between font-display text-lg">
                <dt>Total</dt>
                <dd className="text-gold">{formatNaira(o.total)}</dd>
              </div>
            </dl>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Customer">
            <p className="font-semibold">{o.customer.name}</p>
            <p className="text-sm text-muted-foreground">{o.customer.email || "No email"}</p>
            <a href={`tel:${o.customer.phone}`} className="text-sm text-gold">
              {o.customer.phone}
            </a>
          </Panel>
          <Panel title="Deliver to">
            <p className="text-sm">
              {o.address.street}
              <br />
              {o.address.city}, {o.address.state}
            </p>
          </Panel>
          <Panel title="Payment">
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Status</dt>
                <dd className={unpaid ? "text-ember" : "text-emerald"}>
                  {o.payment?.status ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Channel</dt>
                <dd>{o.payment?.channel.replace("_", " ") ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Reference</dt>
                <dd className="font-mono text-xs">{o.payment?.reference ?? "—"}</dd>
              </div>
            </dl>
          </Panel>
          {o.quoteId && (
            <Panel title="From bulk quote">
              <p className="text-sm text-muted-foreground">
                {o.note || "Created from a bulk quote."}
              </p>
              <Link to="/admin/quotes" className="mt-2 inline-block text-sm text-gold">
                Open quotes →
              </Link>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
