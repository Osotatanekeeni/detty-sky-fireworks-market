import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, CreditCard, MapPin, PackageCheck, Phone, Truck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { WHATSAPP_NUMBER } from "@/lib/data";
import { useCatalogue } from "@/lib/catalogue";
import { formatNaira } from "@/lib/pricing";
import { getCategory } from "@/lib/services";

export const Route = createFileRoute("/delivery")({
  head: () => ({
    meta: [
      {
        title:
          "Fireworks Delivery — Rivers, Akwa Ibom, Bayelsa, Cross River, Delta & Edo — Detty Sky",
      },
      {
        name: "description",
        content:
          "Delivery fees and timelines for every city we cover across the South-South. Port Harcourt next-day delivery.",
      },
      { property: "og:title", content: "Delivery Info — Detty Sky" },
      {
        property: "og:description",
        content: "Fees and timelines across the six South-South states.",
      },
    ],
  }),
  component: Delivery,
});

function Delivery() {
  const { zones, blocks } = useCatalogue();
  const [open, setOpen] = useState<string>(zones[0]?.state ?? "");
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <p className="text-xs uppercase tracking-[0.2em] text-magenta">Delivery</p>
      <h1 className="text-4xl sm:text-5xl">
        From our store to your <span className="text-gold-gradient">sky</span>
      </h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        We deliver across all six South-South states with our own trusted riders and logistics
        partners. Fireworks are packed in sealed, labelled boxes and handed only to adults.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [
            Truck,
            "Next-day in PH",
            "Port Harcourt & Obio/Akpor orders before 4pm arrive tomorrow.",
          ],
          [Clock, "1–5 days elsewhere", "Timeline depends on your city — see the table below."],
          [
            Phone,
            "We call first",
            "Your rider calls before arriving. Someone 18+ must receive the order.",
          ],
          [CreditCard, "Prepaid only", "Pay securely online with Paystack. No pay on delivery."],
        ].map(([I, t, b]) => {
          const Icon = I as typeof Truck;
          return (
            <div key={t as string} className="glass rounded-2xl p-5">
              <Icon className="h-5 w-5 text-gold" />
              <h2 className="mt-2 font-sans text-sm font-bold">{t as string}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{b as string}</p>
            </div>
          );
        })}
      </div>

      <section className="mt-14" aria-labelledby="fees-h">
        <h2 id="fees-h" className="text-2xl">
          Fees & timelines by city
        </h2>
        <div className="mt-6 space-y-3">
          {zones.map((z) => {
            const isOpen = open === z.state;
            const min = Math.min(...z.cities.map((c) => c.fee));
            const blocked = blocks[z.state] ?? [];
            return (
              <div key={z.state} className="glass overflow-hidden rounded-2xl">
                <button
                  className="flex w-full items-center gap-3 p-4 text-left"
                  onClick={() => setOpen(isOpen ? "" : z.state)}
                  aria-expanded={isOpen}
                  aria-controls={`zone-${z.state}`}
                >
                  <MapPin className="h-5 w-5 text-gold" />
                  <span className="flex-1 font-display">{z.state}</span>
                  <span className="text-sm text-muted-foreground">from {formatNaira(min)}</span>
                  <span
                    className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
                    aria-hidden
                  >
                    ▾
                  </span>
                </button>
                {isOpen && (
                  <div id={`zone-${z.state}`} className="border-t border-border px-4 pb-4">
                    <table className="mt-2 w-full text-sm">
                      <thead className="text-left text-xs uppercase tracking-widest text-muted-foreground">
                        <tr>
                          <th className="py-2 font-semibold">City</th>
                          <th className="font-semibold">Fee</th>
                          <th className="font-semibold">Arrives in</th>
                        </tr>
                      </thead>
                      <tbody>
                        {z.cities.map((c) => (
                          <tr key={c.name} className="border-t border-border/60">
                            <td className="py-2">{c.name}</td>
                            <td>{formatNaira(c.fee)}</td>
                            <td>{c.days === 1 ? "Next day" : `${c.days} days`}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {blocked.length > 0 && (
                      <p className="mt-3 rounded-xl bg-ember/10 p-3 text-xs text-ember">
                        Currently unavailable in {z.state}:{" "}
                        {blocked.map((b) => getCategory(b)?.name).join(", ")} (local restrictions).
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Don't see your city?{" "}
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hi! Do you deliver to my area?")}`}
            className="text-gold underline"
            target="_blank"
            rel="noreferrer"
          >
            Ask us on WhatsApp
          </a>{" "}
          — we're adding new areas every week.
        </p>
      </section>

      <section className="glass mt-14 rounded-3xl p-6 sm:p-8" aria-labelledby="pre-h">
        <div className="flex items-start gap-4">
          <PackageCheck className="mt-1 h-6 w-6 shrink-0 text-gold" />
          <div>
            <h2 id="pre-h" className="text-xl">
              Pre-orders & the December rush
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Pre-order items show their arrival date on the product page. Everything in a pre-order
              ships together as soon as stock lands — always before New Year's Eve. Between 20–31
              December, order early: riders are busiest and same-day slots fill up fast.
            </p>
          </div>
        </div>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Button asChild variant="gold" size="lg">
          <Link to="/shop">Start shopping</Link>
        </Button>
        <Button asChild variant="glass" size="lg">
          <Link to="/track">Track an order</Link>
        </Button>
      </div>
    </div>
  );
}
