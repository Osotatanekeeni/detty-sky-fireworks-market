import { Check, Package, PartyPopper, Truck } from "lucide-react";
import type { Order, OrderStatus } from "@/lib/types";
import { formatDateTime } from "./forms";

export const ORDER_STEPS: {
  status: OrderStatus;
  label: string;
  blurb: string;
  icon: typeof Check;
}[] = [
  {
    status: "Processing",
    label: "Processing",
    blurb: "Payment confirmed — we're packing your order",
    icon: Package,
  },
  { status: "Dispatched", label: "Dispatched", blurb: "Left our Port Harcourt store", icon: Truck },
  {
    status: "Out for Delivery",
    label: "Out for delivery",
    blurb: "Rider is on the way to you",
    icon: Truck,
  },
  {
    status: "Delivered",
    label: "Delivered",
    blurb: "Enjoy the show — light responsibly!",
    icon: PartyPopper,
  },
];

export function OrderTimeline({ order }: { order: Order }) {
  if (order.status === "Cancelled")
    return (
      <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
        This order was cancelled because payment wasn't completed in time. Nothing was charged —
        place a new order any time.
      </p>
    );
  // -1 while awaiting payment: no step is done yet.
  const current = ORDER_STEPS.findIndex((s) => s.status === order.status);
  return (
    <ol className="relative space-y-6" aria-label="Order progress">
      {ORDER_STEPS.map((step, i) => {
        const done = i <= current;
        const at = order.history.find((h) => h.status === step.status)?.at;
        const Icon = done && i < current ? Check : step.icon;
        return (
          <li
            key={step.status}
            className="relative flex gap-4"
            aria-current={i === current ? "step" : undefined}
          >
            {i < ORDER_STEPS.length - 1 && (
              <span
                aria-hidden
                className={`absolute left-[19px] top-10 h-[calc(100%-8px)] w-0.5 ${i < current ? "bg-gold" : "bg-border"}`}
              />
            )}
            <span
              className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${
                i === current
                  ? "border-gold bg-gold-gradient text-primary-foreground shadow-glow"
                  : done
                    ? "border-gold bg-gold/15 text-gold"
                    : "border-border text-muted-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="pt-1.5">
              <p className={`font-semibold ${done ? "" : "text-muted-foreground"}`}>{step.label}</p>
              <p className="text-sm text-muted-foreground">{step.blurb}</p>
              {at && <p className="mt-0.5 text-xs text-gold">{formatDateTime(at)}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function StatusPill({ status }: { status: OrderStatus }) {
  const tone: Record<OrderStatus, string> = {
    "Awaiting payment": "bg-secondary text-muted-foreground border-border",
    Cancelled: "bg-destructive/15 text-destructive border-destructive/40",
    Processing: "bg-gold/15 text-gold border-gold/40",
    Dispatched: "bg-ember/15 text-ember border-ember/40",
    "Out for Delivery": "bg-magenta/15 text-magenta border-magenta/40",
    Delivered: "bg-emerald/15 text-emerald border-emerald/40",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tone[status]}`}
    >
      {status}
    </span>
  );
}
