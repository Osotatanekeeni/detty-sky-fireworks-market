import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Building2,
  ShoppingCart,
  CreditCard,
  Hash,
  Loader2,
  Lock,
  MapPin,
  ShieldCheck,
  Tag,
  Truck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  Field,
  NG_PHONE,
  StateCityPicker,
  errProps,
  formatDate,
  inputClass,
  issuesToErrors,
  normalisePhone,
} from "@/components/site/forms";
import { Button } from "@/components/ui/button";
import { priceCart } from "@/lib/checkout";
import { checkCode, createCheckout } from "@/lib/checkout.functions";
import { formatNaira } from "@/lib/pricing";
import { getCategory } from "@/lib/services";
import { useAddresses } from "@/lib/addresses";
import { useAuth } from "@/lib/auth";
import { useCatalogue } from "@/lib/catalogue";
import { useStore } from "@/lib/store";
import type { StateName } from "@/lib/types";
import { formatArrives } from "@/lib/db-map";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — Detty Sky" },
      {
        name: "description",
        content: "Secure checkout with Paystack. Delivery across the South-South.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Checkout,
});

const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name"),
  email: z.string().trim().email("Enter a valid email — your receipt goes here"),
  phone: z
    .string()
    .transform(normalisePhone)
    .refine((v) => NG_PHONE.test(v), "Enter a Nigerian phone number, e.g. 0803 123 4567"),
  state: z.string().min(1, "Choose a state"),
  city: z.string().min(1, "Choose a city"),
  street: z.string().trim().min(5, "Enter your street address and a landmark"),
});
type Form = {
  name: string;
  email: string;
  phone: string;
  state: StateName | "";
  city: string;
  street: string;
};

function Checkout() {
  const { cart, rememberOrder, deliveryState } = useStore();
  const { user } = useAuth();
  const { addresses } = useAddresses(user?.id ?? null);
  const catalogue = useCatalogue();
  // Codes aren't public: the server checks one when it's applied (and again at payment).
  const [validCode, setValidCode] = useState<{ code: string; pct: number } | null>(null);
  const tables = useMemo(
    () => ({ ...catalogue, codes: validCode ? [{ ...validCode, active: true, uses: 0 }] : [] }),
    [catalogue, validCode],
  );
  const [form, setForm] = useState<Form>({
    name: "",
    email: "",
    phone: "",
    state: "",
    city: "",
    street: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [codeInput, setCodeInput] = useState("");
  const [code, setCode] = useState("");
  const [paying, setPaying] = useState(false);
  const [checkingCode, setCheckingCode] = useState(false);
  const applyCode = async () => {
    const c = codeInput.trim();
    if (!c) return;
    setCheckingCode(true);
    try {
      setValidCode(await checkCode({ data: c }));
    } catch {
      setValidCode(null);
    }
    setCode(c);
    setCheckingCode(false);
  };

  // Prefill from the signed-in customer / their first saved address / the header's "deliver to".
  useEffect(() => {
    setForm((f) => {
      const a = addresses[0];
      return {
        name: f.name || user?.name || "",
        email: f.email || user?.email || "",
        phone: f.phone || user?.phone || a?.phone || "",
        state: f.state || a?.state || deliveryState || "",
        city: f.city || a?.city || "",
        street: f.street || a?.street || "",
      };
    });
  }, [user, addresses, deliveryState]);

  const priced = useMemo(
    () =>
      priceCart(tables, {
        lines: cart,
        state: form.state || undefined,
        city: form.city || undefined,
        code: code || undefined,
      }),
    [tables, cart, form.state, form.city, code],
  );
  const hasPreorder = priced.lines.some((l) => l.preorderArrives);
  const set = (patch: Partial<Form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const n = { ...e };
      for (const k of Object.keys(patch)) delete n[k];
      return n;
    });
  };

  if (!priced.lines.length)
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <ShoppingCart className="mx-auto h-12 w-12 text-gold" aria-hidden />
        <h1 className="mt-4 text-2xl">Nothing to check out yet</h1>
        <p className="mt-2 text-muted-foreground">Add some sparkle to your cart first.</p>
        <Button asChild variant="gold" size="lg" className="mt-6">
          <Link to="/shop">Start shopping</Link>
        </Button>
      </div>
    );

  const startPayment = async () => {
    const r = schema.safeParse(form);
    if (!r.success) {
      setErrors(issuesToErrors(r.error.issues));
      toast.error("Please fix the highlighted fields");
      document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
      return;
    }
    if (priced.problems.length) {
      toast.error(priced.problems[0]);
      return;
    }
    // The server re-prices the cart itself; we only send what's in it.
    setPaying(true);
    try {
      const res = await createCheckout({
        data: {
          lines: cart.map((l) => ({
            qty: l.qty,
            ...(l.productId ? { productId: l.productId } : { bundleId: l.bundleId }),
          })),
          contact: { name: r.data.name, email: r.data.email, phone: r.data.phone },
          address: { state: r.data.state as StateName, city: r.data.city, street: r.data.street },
          ...(code ? { code } : {}),
        },
      });
      if (!res.ok) {
        setPaying(false);
        toast.error(res.problems[0] ?? "Checkout failed");
        return;
      }
      rememberOrder(res.orderNumber, res.reference);
      window.location.assign(res.authorizationUrl);
    } catch {
      setPaying(false);
      toast.error("Something went wrong starting payment. You have not been charged.");
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-xs uppercase tracking-[0.2em] text-magenta">Checkout</p>
      <h1 className="text-3xl sm:text-4xl">Almost there</h1>
      {!user && (
        <p className="mt-2 text-sm text-muted-foreground">
          Checking out as a guest.{" "}
          <Link to="/account" className="text-gold underline">
            Sign in
          </Link>{" "}
          to use saved addresses — or create an account after you pay.
        </p>
      )}

      <form
        className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]"
        onSubmit={(e) => {
          e.preventDefault();
          void startPayment();
        }}
        noValidate
      >
        <div className="space-y-6">
          <section className="glass rounded-3xl p-5 sm:p-6" aria-labelledby="contact-h">
            <h2 id="contact-h" className="flex items-center gap-2 text-lg">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold-gradient text-xs text-primary-foreground">
                1
              </span>{" "}
              Contact
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field
                label="Full name"
                htmlFor="name"
                error={errors["name"]}
                className="sm:col-span-2"
              >
                <input
                  id="name"
                  autoComplete="name"
                  value={form.name}
                  onChange={(e) => set({ name: e.target.value })}
                  className={inputClass}
                  {...errProps("name", errors["name"])}
                />
              </Field>
              <Field label="Email" htmlFor="email" error={errors["email"]}>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => set({ email: e.target.value })}
                  className={inputClass}
                  {...errProps("email", errors["email"])}
                />
              </Field>
              <Field
                label="Phone (WhatsApp)"
                htmlFor="phone"
                error={errors["phone"]}
                hint="The rider calls this number on delivery day"
              >
                <input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="0803 123 4567"
                  value={form.phone}
                  onChange={(e) => set({ phone: e.target.value })}
                  className={inputClass}
                  {...errProps("phone", errors["phone"])}
                />
              </Field>
            </div>
          </section>

          <section className="glass rounded-3xl p-5 sm:p-6" aria-labelledby="delivery-h">
            <h2 id="delivery-h" className="flex items-center gap-2 text-lg">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold-gradient text-xs text-primary-foreground">
                2
              </span>{" "}
              Delivery
            </h2>
            {addresses.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Saved addresses">
                {addresses.map((a) => {
                  const active =
                    a.state === form.state && a.city === form.city && a.street === form.street;
                  return (
                    <button
                      type="button"
                      key={a.id}
                      onClick={() =>
                        set({
                          state: a.state,
                          city: a.city,
                          street: a.street,
                          phone: form.phone || a.phone,
                        })
                      }
                      className={`rounded-full border px-3 py-1.5 text-xs ${active ? "border-gold bg-gold/15 text-gold" : "border-border hover:border-gold/50"}`}
                    >
                      <MapPin className="mr-1 inline h-3 w-3" />
                      {a.label} · {a.city}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="mt-5 space-y-4">
              <StateCityPicker
                state={form.state}
                city={form.city}
                onChange={(v) => set(v)}
                errors={{ state: errors["state"], city: errors["city"] }}
              />
              <Field label="Street address & landmark" htmlFor="street" error={errors["street"]}>
                <input
                  id="street"
                  autoComplete="street-address"
                  placeholder="12 Aba Road, opposite Genesis Centre"
                  value={form.street}
                  onChange={(e) => set({ street: e.target.value })}
                  className={inputClass}
                  {...errProps("street", errors["street"])}
                />
              </Field>
            </div>
            {priced.delivery && (
              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald/40 bg-emerald/10 p-4 text-sm">
                <Truck className="mt-0.5 h-5 w-5 shrink-0 text-emerald" />
                <div>
                  <p>
                    <strong>{formatNaira(priced.delivery.fee)}</strong> delivery to {form.city} ·{" "}
                    {priced.delivery.days === 1 ? "next day" : `${priced.delivery.days} days`}
                  </p>
                  <p className="text-muted-foreground">
                    Estimated arrival {formatDate(priced.delivery.eta)}
                    {hasPreorder
                      ? ". Pre-order items ship when stock lands, before New Year's Eve."
                      : "."}
                  </p>
                </div>
              </div>
            )}
            {priced.blocked.length > 0 && (
              <div
                className="mt-5 flex items-start gap-3 rounded-2xl border border-destructive/50 bg-destructive/10 p-4 text-sm"
                role="alert"
              >
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                <div>
                  <p className="font-semibold">Can't deliver these to {form.state} right now</p>
                  <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                    {priced.blocked.map((b) => (
                      <li key={b.name + b.category}>
                        {b.name} ({getCategory(b.category)?.name}) — restricted by local authorities
                      </li>
                    ))}
                  </ul>
                  <Link to="/cart" className="mt-2 inline-block text-gold underline">
                    Edit cart
                  </Link>
                </div>
              </div>
            )}
            {priced.outOfStock.length > 0 && (
              <div
                className="mt-5 flex items-start gap-3 rounded-2xl border border-ember/50 bg-ember/10 p-4 text-sm"
                role="alert"
              >
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-ember" />
                <ul className="text-muted-foreground">
                  {priced.outOfStock.map((o) => (
                    <li key={o.name}>
                      <strong className="text-foreground">{o.name}</strong>: only {o.available} left
                      (you have {o.requested})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="glass rounded-3xl p-5 sm:p-6" aria-labelledby="pay-h">
            <h2 id="pay-h" className="flex items-center gap-2 text-lg">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold-gradient text-xs text-primary-foreground">
                3
              </span>{" "}
              Payment
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Pay securely with Paystack — card, bank transfer or USSD. We don't offer pay on
              delivery.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {[
                ["Card", CreditCard],
                ["Bank transfer", Building2],
                ["USSD", Hash],
              ].map(([l, I]) => {
                const Icon = I as typeof CreditCard;
                return (
                  <span
                    key={l as string}
                    className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5"
                  >
                    <Icon className="h-3.5 w-3.5 text-gold" />
                    {l as string}
                  </span>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="glass h-fit rounded-3xl p-5 lg:sticky lg:top-32">
          <h2 className="text-lg">Order summary</h2>
          <ul className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
            {priced.lines.map((l) => (
              <li key={l.key} className="flex gap-3 text-sm">
                <div className="relative">
                  <img src={l.image} alt="" className="h-14 w-14 rounded-lg object-cover" />
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-gradient px-1 text-[10px] font-bold text-primary-foreground">
                    {l.qty}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold leading-snug">{l.name}</p>
                  {l.preorderArrives && (
                    <p className="text-xs text-gold">Pre-order · arrives {formatArrives(l.preorderArrives)}</p>
                  )}
                  {l.discount > 0 && (
                    <p className="text-xs text-emerald">Bulk −{formatNaira(l.discount)}</p>
                  )}
                </div>
                <span className="font-semibold">{formatNaira(l.total)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-5">
            <label htmlFor="code" className="sr-only">
              Discount code
            </label>
            <div className="flex gap-2">
              <div className="glass flex flex-1 items-center gap-2 rounded-full px-3">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <input
                  id="code"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  placeholder="Discount code"
                  className="h-10 w-full bg-transparent text-sm uppercase outline-none placeholder:normal-case placeholder:text-muted-foreground"
                />
              </div>
              <Button
                type="button"
                variant="glass"
                className="h-10"
                onClick={() => void applyCode()}
                disabled={!codeInput.trim() || checkingCode}
              >
                Apply
              </Button>
            </div>
            {priced.codeError && (
              <p className="mt-1 text-xs text-destructive" role="alert">
                {priced.codeError}
              </p>
            )}
            {priced.code && (
              <p className="mt-1 text-xs text-emerald">
                {priced.code.code} applied — {priced.code.pct}% off{" "}
                <button
                  type="button"
                  className="ml-1 underline"
                  onClick={() => {
                    setCode("");
                    setCodeInput("");
                    setValidCode(null);
                  }}
                >
                  Remove
                </button>
              </p>
            )}
          </div>

          <dl className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{formatNaira(priced.subtotal)}</dd>
            </div>
            {priced.bulkDiscount > 0 && (
              <div className="flex justify-between text-emerald">
                <dt>Bulk discount</dt>
                <dd>−{formatNaira(priced.bulkDiscount)}</dd>
              </div>
            )}
            {priced.code && (
              <div className="flex justify-between text-emerald">
                <dt>Code {priced.code.code}</dt>
                <dd>−{formatNaira(priced.code.amount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt>Delivery</dt>
              <dd>
                {priced.delivery ? (
                  formatNaira(priced.delivery.fee)
                ) : (
                  <span className="text-muted-foreground">Choose city</span>
                )}
              </dd>
            </div>
            <div className="flex justify-between border-t border-border pt-3 font-display text-lg">
              <dt>Total</dt>
              <dd className="text-gold">{formatNaira(priced.total)}</dd>
            </div>
          </dl>

          <Button type="submit" variant="paystack" size="lg" className="mt-5 w-full" disabled={paying}>
            {paying ? <Loader2 className="animate-spin" /> : <Lock />}{" "}
            {paying ? "Taking you to Paystack…" : `Pay ${formatNaira(priced.total)} with Paystack`}
          </Button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald" /> Secured by Paystack
            only
          </p>
        </aside>
      </form>

    </div>
  );
}
