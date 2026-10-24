import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, CheckCircle2, Church, Hotel, PartyPopper, Percent, Truck } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { Fireworks } from "@/components/site/Fireworks";
import {
  Field,
  NG_PHONE,
  StateCityPicker,
  errProps,
  inputClass,
  issuesToErrors,
  normalisePhone,
  textareaClass,
} from "@/components/site/forms";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Turnstile, turnstileReady } from "@/components/site/Turnstile";
import { submitQuote } from "@/lib/orders.functions";
import type { StateName } from "@/lib/types";

export const Route = createFileRoute("/bulk")({
  head: () => ({
    meta: [
      { title: "Bulk Fireworks Quotes for Churches, Events & Hotels — Detty Sky" },
      {
        name: "description",
        content:
          "Request a custom bulk fireworks quote for church crossover, weddings, hotels and corporate events across the South-South.",
      },
      { property: "og:title", content: "Bulk Fireworks Quotes — Detty Sky" },
      {
        property: "og:description",
        content: "Custom pricing for churches, event planners, hotels and clubs.",
      },
    ],
  }),
  component: Bulk,
});

const ORG_TYPES = [
  "Church",
  "Event planner",
  "Hotel",
  "Club / lounge",
  "Corporate",
  "Estate / community",
  "Other",
];

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name or organisation"),
  orgType: z.string().min(1, "Choose an organisation type"),
  eventDate: z
    .string()
    .min(1, "Choose the event date")
    .refine(
      (d) => new Date(d) >= new Date(new Date().toDateString()),
      "Event date can't be in the past",
    ),
  state: z.string().min(1, "Choose a state"),
  city: z.string().min(1, "Choose a city"),
  request: z.string().trim().min(5, "Tell us what you'd like — products or the kind of show"),
  quantity: z.string().trim().min(1, "Give a quantity or a budget"),
  phone: z
    .string()
    .transform(normalisePhone)
    .refine((v) => NG_PHONE.test(v), "Enter a Nigerian phone number"),
  email: z.string().trim().email("Enter a valid email").or(z.literal("")),
  notes: z.string(),
});

const empty = {
  name: "",
  orgType: "",
  eventDate: "",
  state: "" as StateName | "",
  city: "",
  request: "",
  quantity: "",
  phone: "",
  email: "",
  notes: "",
};

function Bulk() {
  const [f, setF] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sentId, setSentId] = useState<string | null>(null);
  const set = (patch: Partial<typeof f>) => {
    setF((x) => ({ ...x, ...patch }));
    setErrors((e) => {
      const n = { ...e };
      for (const k of Object.keys(patch)) delete n[k];
      return n;
    });
  };

  const [busy, setBusy] = useState(false);
  const [captcha, setCaptcha] = useState("");
  const [captchaReset, setCaptchaReset] = useState(0);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = schema.safeParse(f);
    if (!r.success) {
      setErrors(issuesToErrors(r.error.issues));
      setTimeout(() => document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
      return;
    }
    const { email, ...rest } = r.data;
    setBusy(true);
    try {
      await submitQuote({
        data: { ...rest, ...(email ? { email } : {}), ...(captcha ? { turnstileToken: captcha } : {}) },
      });
      setSentId("sent");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send your request");
      setCaptchaReset((n) => n + 1); // tokens are single-use
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-70">
          <Fireworks intensity={0.7} />
        </div>
        <div className="relative mx-auto max-w-5xl px-4 py-16 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-magenta">Bulk orders</p>
          <h1 className="mx-auto mt-2 max-w-3xl text-4xl sm:text-5xl">
            Lighting up the whole <span className="text-gold-gradient">congregation?</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Churches, event planners, hotels and clubs get custom pricing, priority December stock
            and scheduled delivery. Tell us what you need — we reply within 24 hours.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-2 text-sm">
            {[
              [Church, "Crossover services"],
              [PartyPopper, "Weddings & parties"],
              [Hotel, "Hotel NYE shows"],
              [Building2, "Corporate events"],
            ].map(([I, l]) => {
              const Icon = I as typeof Church;
              return (
                <span
                  key={l as string}
                  className="glass flex items-center gap-2 rounded-full px-4 py-2"
                >
                  <Icon className="h-4 w-4 text-gold" />
                  {l as string}
                </span>
              );
            })}
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 lg:grid-cols-[1fr_320px]">
        {sentId ? (
          <div className="glass rounded-3xl p-10 text-center shadow-glow" role="status">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald" />
            <h2 className="mt-4 text-2xl">Request received!</h2>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">
              Our team will call or WhatsApp you on{" "}
              <strong className="text-foreground">{f.phone}</strong> within 24 hours with a custom
              quote.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild variant="gold">
                <Link to="/shop">Browse while you wait</Link>
              </Button>
              <Button
                variant="glass"
                onClick={() => {
                  setSentId(null);
                  setF(empty);
                }}
              >
                Send another request
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="glass space-y-5 rounded-3xl p-5 sm:p-8"
            onSubmit={submit}
            noValidate
            aria-labelledby="quote-h"
          >
            <h2 id="quote-h" className="text-xl">
              Request a quote
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name / organisation" htmlFor="q-name" error={errors["name"]}>
                <input
                  id="q-name"
                  autoComplete="organization"
                  value={f.name}
                  onChange={(e) => set({ name: e.target.value })}
                  className={inputClass}
                  {...errProps("q-name", errors["name"])}
                />
              </Field>
              <Field label="Organisation type" htmlFor="q-org" error={errors["orgType"]}>
                <select
                  id="q-org"
                  value={f.orgType}
                  onChange={(e) => set({ orgType: e.target.value })}
                  className={inputClass}
                  {...errProps("q-org", errors["orgType"])}
                >
                  <option value="">Select type</option>
                  {ORG_TYPES.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Field>
              <Field label="Event date" htmlFor="q-date" error={errors["eventDate"]}>
                <input
                  id="q-date"
                  type="date"
                  value={f.eventDate}
                  onChange={(e) => set({ eventDate: e.target.value })}
                  className={`${inputClass} [color-scheme:dark]`}
                  {...errProps("q-date", errors["eventDate"])}
                />
              </Field>
              <Field
                label="Quantity or budget"
                htmlFor="q-qty"
                error={errors["quantity"]}
                hint="e.g. 50 units, or ₦1.5m budget"
              >
                <input
                  id="q-qty"
                  value={f.quantity}
                  onChange={(e) => set({ quantity: e.target.value })}
                  className={inputClass}
                  {...errProps("q-qty", errors["quantity"])}
                />
              </Field>
            </div>
            <StateCityPicker
              idPrefix="q"
              state={f.state}
              city={f.city}
              onChange={(v) => set(v)}
              errors={{ state: errors["state"], city: errors["city"] }}
            />
            <Field
              label="What do you need?"
              htmlFor="q-req"
              error={errors["request"]}
              hint="Products you have in mind, or describe the show (crowd size, venue, duration)"
            >
              <textarea
                id="q-req"
                value={f.request}
                onChange={(e) => set({ request: e.target.value })}
                className={textareaClass}
                {...errProps("q-req", errors["request"])}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone / WhatsApp" htmlFor="q-phone" error={errors["phone"]}>
                <input
                  id="q-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={f.phone}
                  onChange={(e) => set({ phone: e.target.value })}
                  className={inputClass}
                  {...errProps("q-phone", errors["phone"])}
                />
              </Field>
              <Field label="Email (optional)" htmlFor="q-email" error={errors["email"]}>
                <input
                  id="q-email"
                  type="email"
                  autoComplete="email"
                  value={f.email}
                  onChange={(e) => set({ email: e.target.value })}
                  className={inputClass}
                  {...errProps("q-email", errors["email"])}
                />
              </Field>
            </div>
            <Field label="Anything else? (optional)" htmlFor="q-notes">
              <textarea
                id="q-notes"
                value={f.notes}
                onChange={(e) => set({ notes: e.target.value })}
                className={textareaClass}
                placeholder="Delivery time window, invoice needs, venue access…"
              />
            </Field>
            <Turnstile onToken={setCaptcha} resetKey={captchaReset} action="bulk-quote" />
            <Button
              type="submit"
              variant="gold"
              size="lg"
              className="w-full sm:w-auto"
              disabled={busy || !turnstileReady(captcha)}
            >
              Send request
            </Button>
          </form>
        )}

        <aside className="space-y-4">
          {[
            [
              Percent,
              "Volume pricing",
              "Automatic 5% off 10+ units and 10% off 25+ — custom quotes go further.",
            ],
            [
              Truck,
              "Scheduled delivery",
              "Pick a delivery day before your event, anywhere in the six South-South states.",
            ],
            [
              Church,
              "December priority",
              "Bulk buyers get first access to pre-order stock before it sells out.",
            ],
          ].map(([I, t, b]) => {
            const Icon = I as typeof Percent;
            return (
              <div key={t as string} className="glass rounded-2xl p-5">
                <Icon className="h-5 w-5 text-gold" />
                <h3 className="mt-2 font-sans text-sm font-bold">{t as string}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{b as string}</p>
              </div>
            );
          })}
        </aside>
      </div>
    </div>
  );
}
