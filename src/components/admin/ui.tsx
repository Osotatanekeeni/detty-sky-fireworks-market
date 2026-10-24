import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-border bg-card p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && (
            <h2 className="font-sans text-sm font-bold uppercase tracking-widest text-muted-foreground">
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = "gold",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "gold" | "magenta" | "emerald" | "ember";
}) {
  const c = {
    gold: "text-gold",
    magenta: "text-magenta",
    emerald: "text-emerald",
    ember: "text-ember",
  }[tone];
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className={`mt-2 font-display text-2xl ${c}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** Horizontal-scrolling table wrapper so wide admin tables never push the page sideways. */
export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-full min-w-[640px] text-sm">{children}</table>
    </div>
  );
}
export const th =
  "py-2 pr-4 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground";
export const td = "border-t border-border py-3 pr-4 align-middle";

export const adminInput =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-gold/70 aria-[invalid=true]:border-destructive";
export const adminTextarea =
  "min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold/70";

export function AdminField({
  label,
  htmlFor,
  children,
  hint,
  className = "",
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-semibold text-muted-foreground">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-emerald" : "bg-secondary"}`}
    >
      <span
        className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-foreground transition-transform ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`}
      />
    </button>
  );
}
