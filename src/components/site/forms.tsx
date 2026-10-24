import type { ReactNode } from "react";
import { STATES } from "@/lib/data";
import { useCatalogue } from "@/lib/catalogue";
import type { StateName } from "@/lib/types";

export const inputClass =
  "glass h-11 w-full rounded-xl px-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-gold/70 aria-[invalid=true]:border-destructive";
export const textareaClass =
  "glass min-h-28 w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-gold/70 aria-[invalid=true]:border-destructive";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className = "",
}: {
  label: string;
  htmlFor: string;
  error?: string | undefined;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-muted-foreground"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="mt-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Props that wire an input to its Field's error message. */
export const errProps = (id: string, error?: string) =>
  error ? { "aria-invalid": true as const, "aria-describedby": `${id}-error` } : {};

/** State + city selects, limited to the six South-South states and the cities we deliver to. */
export function StateCityPicker({
  state,
  city,
  onChange,
  errors = {},
  idPrefix = "addr",
}: {
  state: StateName | "";
  city: string;
  onChange: (v: { state: StateName | ""; city: string }) => void;
  errors?: { state?: string | undefined; city?: string | undefined };
  idPrefix?: string;
}) {
  const { zones } = useCatalogue();
  const cities = zones.find((z) => z.state === state)?.cities ?? [];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="State" htmlFor={`${idPrefix}-state`} error={errors.state}>
        <select
          id={`${idPrefix}-state`}
          value={state}
          className={inputClass}
          {...errProps(`${idPrefix}-state`, errors.state)}
          onChange={(e) => onChange({ state: e.target.value as StateName | "", city: "" })}
        >
          <option value="">Select state</option>
          {STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>
      <Field label="City / LGA" htmlFor={`${idPrefix}-city`} error={errors.city}>
        <select
          id={`${idPrefix}-city`}
          value={city}
          disabled={!state}
          className={inputClass}
          {...errProps(`${idPrefix}-city`, errors.city)}
          onChange={(e) => onChange({ state, city: e.target.value })}
        >
          <option value="">{state ? "Select city" : "Choose a state first"}</option>
          {cities.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

/** Collects zod issues into a { field: message } map (first message per field). */
export function issuesToErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const k = i.path.map(String).join(".");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

/** Nigerian mobile number: 080…, 070…, 081…, 090…, 091… or +234…. */
export const NG_PHONE = /^(\+?234|0)[789][01]\d{8}$/;
export const normalisePhone = (p: string) => p.replace(/[\s-]/g, "");

export const formatDate = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
