import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getOrder } from "@/lib/orders.functions";
import { rememberTrackingPhone } from "@/lib/tracking";
import { Field, inputClass } from "./forms";

export function TrackForm({
  initialId = "",
  notFound = false,
}: {
  initialId?: string;
  notFound?: boolean;
}) {
  const nav = useNavigate();
  const [id, setId] = useState(initialId);
  const [phone, setPhone] = useState("");
  const [miss, setMiss] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div className="mx-auto max-w-md px-4 py-20">
      <p className="text-xs uppercase tracking-[0.2em] text-magenta">Track an order</p>
      <h1 className="text-3xl">Where's my order?</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Enter your order number and the phone number you used at checkout.
      </p>
      {(notFound && initialId && phone === "") || miss ? (
        <p className="mt-4 rounded-xl border border-ember/50 bg-ember/10 p-3 text-sm" role="alert">
          We couldn't find an order matching those details. Check the number in your receipt email.
        </p>
      ) : null}
      <form
        className="mt-6 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const number = id.trim().toUpperCase();
          setBusy(true);
          const o = await getOrder({ data: { number, phone } }).catch(() => null);
          setBusy(false);
          if (!o) {
            setMiss(true);
            return;
          }
          rememberTrackingPhone(o.id, phone);
          nav({ to: "/order/$id", params: { id: o.id } });
        }}
      >
        <Field label="Order number" htmlFor="t-id">
          <input
            id="t-id"
            required
            placeholder="DS-10241"
            value={id}
            onChange={(e) => {
              setId(e.target.value.toUpperCase());
              setMiss(false);
            }}
            className={inputClass}
          />
        </Field>
        <Field label="Phone number" htmlFor="t-phone">
          <input
            id="t-phone"
            required
            type="tel"
            inputMode="tel"
            placeholder="0803 123 4567"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setMiss(false);
            }}
            className={inputClass}
          />
        </Field>
        <Button type="submit" variant="gold" size="lg" className="w-full" disabled={busy}>
          Track order
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Have an account?{" "}
        <Link to="/account" className="text-gold underline">
          Sign in
        </Link>{" "}
        to see all your orders.
      </p>
    </div>
  );
}
