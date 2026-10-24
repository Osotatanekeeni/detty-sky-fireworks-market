import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Heart, LogOut, MapPin, Package, Plus, Star, Trash2, User as UserIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { ProductGrid, Stars } from "@/components/site/ProductCard";
import {
  Field,
  NG_PHONE,
  StateCityPicker,
  errProps,
  formatDate,
  inputClass,
  issuesToErrors,
  normalisePhone,
  textareaClass,
} from "@/components/site/forms";
import { StatusPill } from "@/components/site/OrderTimeline";
import { Button } from "@/components/ui/button";
import { submitReview } from "@/lib/actions";
import { useAddresses } from "@/lib/addresses";
import { useAuth } from "@/lib/auth";
import { useCatalogue } from "@/lib/catalogue";
import { useDb } from "@/lib/mock-db";
import { formatNaira } from "@/lib/pricing";
import { useStore } from "@/lib/store";
import type { Order, StateName } from "@/lib/types";

const TABS = ["orders", "wishlist", "addresses", "reviews", "profile"] as const;
type Tab = (typeof TABS)[number];

export const Route = createFileRoute("/account")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } =>
    TABS.includes(s["tab"] as Tab) ? { tab: s["tab"] as Tab } : {},
  head: () => ({
    meta: [{ title: "My Account — Detty Sky" }, { name: "robots", content: "noindex" }],
  }),
  component: Account,
});

function Account() {
  const { user } = useAuth();
  const { hydrated } = useDb();
  const { tab = "orders" } = Route.useSearch();
  if (!hydrated || user === undefined)
    return (
      <div className="mx-auto max-w-5xl px-4 py-24 text-center text-muted-foreground">Loading…</div>
    );
  // Wishlist works without an account.
  if (!user && tab !== "wishlist") return <AuthForms />;

  const items: { id: Tab; label: string; icon: typeof Package }[] = [
    { id: "orders", label: "Orders", icon: Package },
    { id: "wishlist", label: "Wishlist", icon: Heart },
    { id: "addresses", label: "Addresses", icon: MapPin },
    { id: "reviews", label: "My reviews", icon: Star },
    { id: "profile", label: "Profile", icon: UserIcon },
  ];
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-xs uppercase tracking-[0.2em] text-magenta">My account</p>
      <h1 className="text-3xl sm:text-4xl">
        {user ? <>Hey {user.name.split(" ")[0]} 👋</> : "Your wishlist"}
      </h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[220px_1fr]">
        {user && (
          <nav
            aria-label="Account sections"
            className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible"
          >
            {items.map((i) => (
              <Link
                key={i.id}
                to="/account"
                search={{ tab: i.id }}
                className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm lg:rounded-xl ${tab === i.id ? "bg-gold/15 text-gold" : "hover:bg-accent"}`}
              >
                <i.icon className="h-4 w-4" />
                {i.label}
              </Link>
            ))}
          </nav>
        )}
        <div className={user ? "" : "lg:col-span-2"}>
          {tab === "orders" && <Orders />}
          {tab === "wishlist" && <Wishlist />}
          {tab === "addresses" && <Addresses />}
          {tab === "reviews" && <Reviews />}
          {tab === "profile" && <Profile />}
        </div>
      </div>
    </div>
  );
}

function useMyOrders(): Order[] {
  const { orderIds } = useStore();
  const { user } = useAuth();
  const { orders } = useDb();
  return orders.filter(
    (o) =>
      orderIds.includes(o.id) ||
      (user && o.customer.email.toLowerCase() === user.email.toLowerCase()),
  );
}

function Orders() {
  const orders = useMyOrders();
  if (!orders.length)
    return (
      <Empty
        emoji="📦"
        title="No orders yet"
        body="When you place an order it'll show up here with live tracking."
        cta={<Link to="/shop">Start shopping</Link>}
      />
    );
  return (
    <ul className="space-y-3">
      {orders.map((o) => (
        <li key={o.id}>
          <Link
            to="/order/$id"
            params={{ id: o.id }}
            className="glass flex flex-wrap items-center gap-4 rounded-2xl p-4 hover:border-gold/50"
          >
            <div className="flex-1">
              <p className="font-display">{o.id}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(o.createdAt)} · {o.lines.reduce((s, l) => s + l.qty, 0)} items ·{" "}
                {o.address.city}
              </p>
            </div>
            <StatusPill status={o.status} />
            <span className="font-display text-gold">{formatNaira(o.total)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Wishlist() {
  const { wishlist } = useStore();
  const { products } = useCatalogue();
  const list = products.filter((p) => wishlist.includes(p.id));
  if (!list.length)
    return (
      <Empty
        emoji="💛"
        title="Nothing saved yet"
        body="Tap the heart on any firework to plan your December haul."
        cta={<Link to="/shop">Browse fireworks</Link>}
      />
    );
  return <ProductGrid products={list} />;
}

const addressSchema = z.object({
  label: z.string().trim().min(1, "Give it a name, e.g. Home"),
  state: z.string().min(1, "Choose a state"),
  city: z.string().min(1, "Choose a city"),
  street: z.string().trim().min(5, "Enter street and a landmark"),
  phone: z
    .string()
    .transform(normalisePhone)
    .refine((v) => NG_PHONE.test(v), "Enter a Nigerian phone number"),
});

function Addresses() {
  const { user } = useAuth();
  const { addresses, save, remove } = useAddresses(user?.id ?? null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    label: "Home",
    state: "" as StateName | "",
    city: "",
    street: "",
    phone: user?.phone ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <div className="space-y-4">
      {addresses.map((a) => (
        <div key={a.id} className="glass flex items-start gap-3 rounded-2xl p-4 text-sm">
          <MapPin className="mt-0.5 h-4 w-4 text-gold" />
          <div className="flex-1">
            <p className="font-semibold">{a.label}</p>
            <p className="text-muted-foreground">
              {a.street}, {a.city}, {a.state} · {a.phone}
            </p>
          </div>
          <button
            onClick={async () => {
              const err = await remove(a.id);
              if (err) toast.error(err);
            }}
            aria-label={`Remove ${a.label} address`}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      {!addresses.length && !adding && (
        <p className="text-sm text-muted-foreground">
          No saved addresses. Add one to speed through checkout.
        </p>
      )}
      {adding ? (
        <form
          className="glass space-y-4 rounded-2xl p-5"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            const r = addressSchema.safeParse(f);
            if (!r.success) {
              setErrors(issuesToErrors(r.error.issues));
              return;
            }
            setSaving(true);
            const err = await save({ ...r.data, state: r.data.state as StateName });
            setSaving(false);
            if (err) {
              toast.error(err);
              return;
            }
            setAdding(false);
            setErrors({});
            toast.success("Address saved");
          }}
        >
          <Field label="Label" htmlFor="a-label" error={errors["label"]}>
            <input
              id="a-label"
              value={f.label}
              onChange={(e) => setF({ ...f, label: e.target.value })}
              className={inputClass}
              {...errProps("a-label", errors["label"])}
            />
          </Field>
          <StateCityPicker
            idPrefix="a"
            state={f.state}
            city={f.city}
            onChange={(v) => setF({ ...f, ...v })}
            errors={{ state: errors["state"], city: errors["city"] }}
          />
          <Field label="Street & landmark" htmlFor="a-street" error={errors["street"]}>
            <input
              id="a-street"
              value={f.street}
              onChange={(e) => setF({ ...f, street: e.target.value })}
              className={inputClass}
              {...errProps("a-street", errors["street"])}
            />
          </Field>
          <Field label="Phone" htmlFor="a-phone" error={errors["phone"]}>
            <input
              id="a-phone"
              type="tel"
              value={f.phone}
              onChange={(e) => setF({ ...f, phone: e.target.value })}
              className={inputClass}
              {...errProps("a-phone", errors["phone"])}
            />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" variant="gold" disabled={saving}>
              Save address
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="glass" onClick={() => setAdding(true)}>
          <Plus /> Add address
        </Button>
      )}
    </div>
  );
}

function Reviews() {
  const orders = useMyOrders();
  const { reviews } = useDb();
  const { products } = useCatalogue();
  const { user } = useAuth();
  const [writing, setWriting] = useState<{ orderId: string; productId: string } | null>(null);
  const delivered = orders.filter((o) => o.status === "Delivered");
  const reviewable = delivered.flatMap((o) =>
    o.lines.filter((l) => (l.kind ?? "product") === "product").map((l) => ({ order: o, line: l })),
  );
  const done = (orderId: string, productId: string) =>
    reviews.find((r) => r.orderId === orderId && r.productId === productId);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        You can review anything from a delivered order. Reviews show a{" "}
        <strong className="text-emerald">Verified Purchase</strong> badge once approved.
      </p>
      {!reviewable.length && (
        <Empty
          emoji="⭐"
          title="Nothing to review yet"
          body="Once an order is delivered, you can rate each item here."
        />
      )}
      {reviewable.map(({ order, line }) => {
        const p = products.find((x) => x.id === line.productId);
        const existing = done(order.id, line.productId);
        const isWriting = writing?.orderId === order.id && writing.productId === line.productId;
        return (
          <div key={order.id + line.productId} className="glass rounded-2xl p-4">
            <div className="flex items-center gap-3">
              {p && <img src={p.image} alt="" className="h-14 w-14 rounded-lg object-cover" />}
              <div className="flex-1">
                <p className="font-semibold">{line.name}</p>
                <p className="text-xs text-muted-foreground">Order {order.id} · delivered</p>
              </div>
              {existing ? (
                <span className="text-right text-xs">
                  <Stars value={existing.rating} />
                  <br />
                  <span className="text-muted-foreground">
                    {existing.status === "approved"
                      ? "Published"
                      : existing.status === "pending"
                        ? "Awaiting approval"
                        : "Hidden"}
                  </span>
                </span>
              ) : (
                !isWriting && (
                  <Button
                    variant="gold"
                    size="sm"
                    onClick={() => setWriting({ orderId: order.id, productId: line.productId })}
                  >
                    Write review
                  </Button>
                )
              )}
            </div>
            {isWriting && user && (
              <ReviewForm
                onCancel={() => setWriting(null)}
                onSubmit={(v) => {
                  submitReview({
                    ...v,
                    productId: line.productId,
                    orderId: order.id,
                    author:
                      `${user.name.split(" ")[0]} ${user.name.split(" ")[1]?.[0] ?? ""}.`.trim(),
                    city: order.address.city,
                  });
                  setWriting(null);
                  toast.success("Thanks! Your review will appear once approved.");
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ReviewForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (v: {
    rating: number;
    title: string;
    body: string;
    media?: { type: "photo" | "video"; src: string }[];
  }) => void;
  onCancel: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [media, setMedia] = useState<{ type: "photo" | "video"; src: string }[]>([]);
  const [error, setError] = useState("");
  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (file.type.startsWith("video/")) {
      toast("Video uploads switch on when storage is connected (Phase 3). Add a photo for now.");
      return;
    }
    if (file.size > 1_000_000) {
      toast.error("Photos must be under 1 MB in demo mode");
      return;
    }
    const r = new FileReader();
    r.onload = () => setMedia((m) => [...m, { type: "photo", src: String(r.result) }]);
    r.readAsDataURL(file);
  };
  return (
    <form
      className="mt-4 space-y-3 border-t border-border pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!rating) return setError("Tap a star rating");
        if (title.trim().length < 3 || body.trim().length < 10)
          return setError("Add a short title and at least a sentence");
        onSubmit({
          rating,
          title: title.trim(),
          body: body.trim(),
          ...(media.length ? { media } : {}),
        });
      }}
    >
      <div role="radiogroup" aria-label="Rating" className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => {
              setRating(n);
              setError("");
            }}
          >
            <Star
              className={`h-7 w-7 ${n <= rating ? "fill-gold text-gold" : "text-muted-foreground/50"}`}
            />
          </button>
        ))}
      </div>
      <Field label="Title" htmlFor="rv-title">
        <input
          id="rv-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Pure fire!"
          className={inputClass}
        />
      </Field>
      <Field label="Your review" htmlFor="rv-body">
        <textarea
          id="rv-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="How did it go? Duration, noise, crowd reaction…"
          className={textareaClass}
        />
      </Field>
      <div>
        <label
          className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
          htmlFor="rv-media"
        >
          Photo or video (optional)
        </label>
        <input
          id="rv-media"
          type="file"
          accept="image/*,video/*"
          onChange={(e) => onFile(e.target.files?.[0])}
          className="mt-1.5 block text-sm file:mr-3 file:rounded-full file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-foreground"
        />
        {media.length > 0 && (
          <div className="mt-2 flex gap-2">
            {media.map((m, i) => (
              <img
                key={i}
                src={m.src}
                alt="Your upload"
                className="h-16 w-16 rounded-lg object-cover"
              />
            ))}
          </div>
        )}
      </div>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" variant="gold">
          Submit review
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Profile() {
  const { user, updateProfile, signOut } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ name: user?.name ?? "", phone: user?.phone ?? "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  if (!user) return null;
  return (
    <div className="max-w-lg space-y-6">
      <form
        className="glass space-y-4 rounded-2xl p-5"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          const r = profileSchema.safeParse(f);
          if (!r.success) {
            setErrors(issuesToErrors(r.error.issues));
            return;
          }
          const err = await updateProfile(r.data);
          if (err) toast.error(err);
          else toast.success("Profile updated");
        }}
      >
        <Field label="Full name" htmlFor="p-name" error={errors["name"]}>
          <input
            id="p-name"
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
            className={inputClass}
            {...errProps("p-name", errors["name"])}
          />
        </Field>
        <Field label="Email" htmlFor="p-email" hint="Contact us on WhatsApp to change your email.">
          <input id="p-email" type="email" value={user.email} readOnly className={`${inputClass} opacity-70`} />
        </Field>
        <Field label="Phone" htmlFor="p-phone" error={errors["phone"]}>
          <input
            id="p-phone"
            type="tel"
            value={f.phone}
            onChange={(e) => setF({ ...f, phone: e.target.value })}
            className={inputClass}
            {...errProps("p-phone", errors["phone"])}
          />
        </Field>
        <Button type="submit" variant="gold">
          Save changes
        </Button>
      </form>
      <Button
        variant="glass"
        onClick={async () => {
          await signOut();
          nav({ to: "/" });
          toast("Signed out");
        }}
      >
        <LogOut /> Sign out
      </Button>
    </div>
  );
}

const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name"),
  phone: z
    .string()
    .transform(normalisePhone)
    .refine((v) => NG_PHONE.test(v), "Enter a Nigerian phone number"),
});

const signUpSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name"),
  email: z.string().trim().email("Enter a valid email"),
  phone: z
    .string()
    .transform(normalisePhone)
    .refine((v) => NG_PHONE.test(v), "Enter a Nigerian phone number"),
  password: z.string().min(8, "Use at least 8 characters"),
});

/** Supabase Auth, email + password. */
function AuthForms() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "up") {
      const r = signUpSchema.safeParse(f);
      if (!r.success) {
        setErrors(issuesToErrors(r.error.issues));
        return;
      }
      setBusy(true);
      const res = await signUp(r.data);
      setBusy(false);
      if ("error" in res) toast.error(res.error);
      else if (res.needsConfirmation) setSentTo(r.data.email);
      else toast.success("Welcome to Detty Sky! 🎆");
    } else {
      const r = z
        .object({
          email: z.string().trim().email("Enter a valid email"),
          password: z.string().min(1, "Enter your password"),
        })
        .safeParse(f);
      if (!r.success) {
        setErrors(issuesToErrors(r.error.issues));
        return;
      }
      setBusy(true);
      const err = await signIn(r.data.email, r.data.password);
      setBusy(false);
      if (err) toast.error(err);
      else toast.success("Signed in");
    }
  };
  if (sentTo)
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="glass rounded-3xl p-8 text-center shadow-card">
          <p className="text-4xl">📬</p>
          <h1 className="mt-3 text-2xl">Check your inbox</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a confirmation link to <strong className="text-foreground">{sentTo}</strong>. Tap
            it to finish creating your account.
          </p>
        </div>
      </div>
    );
  const input = (k: keyof typeof f, label: string, type = "text", auto?: string) => (
    <Field label={label} htmlFor={`au-${k}`} error={errors[k]}>
      <input
        id={`au-${k}`}
        type={type}
        autoComplete={auto}
        value={f[k]}
        onChange={(e) => {
          setF({ ...f, [k]: e.target.value });
          setErrors({ ...errors, [k]: "" });
        }}
        className={inputClass}
        {...errProps(`au-${k}`, errors[k])}
      />
    </Field>
  );
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="glass rounded-3xl p-6 shadow-card sm:p-8">
        <div className="grid grid-cols-2 rounded-full bg-secondary p-1 text-sm" role="tablist">
          {(["in", "up"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setErrors({});
              }}
              className={`rounded-full py-2 font-semibold ${mode === m ? "bg-gold-gradient text-primary-foreground" : "text-muted-foreground"}`}
            >
              {m === "in" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>
        <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
          {mode === "up" && input("name", "Full name", "text", "name")}
          {input("email", "Email", "email", "email")}
          {mode === "up" && input("phone", "Phone (WhatsApp)", "tel", "tel")}
          {input(
            "password",
            "Password",
            "password",
            mode === "in" ? "current-password" : "new-password",
          )}
          <Button type="submit" variant="gold" size="lg" className="w-full" disabled={busy}>
            {mode === "in" ? "Sign in" : "Create account"}
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Guest orders placed with the same email appear in your account automatically.
        </p>
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Just want to track an order?{" "}
        <Link to="/track" className="text-gold underline">
          Track without an account
        </Link>
      </p>
    </div>
  );
}

function Empty({
  emoji,
  title,
  body,
  cta,
}: {
  emoji: string;
  title: string;
  body: string;
  cta?: React.ReactNode;
}) {
  return (
    <div className="glass rounded-3xl p-10 text-center">
      <p className="text-4xl">{emoji}</p>
      <h2 className="mt-3 text-xl">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      {cta && (
        <Button asChild variant="gold" className="mt-5">
          {cta}
        </Button>
      )}
    </div>
  );
}
