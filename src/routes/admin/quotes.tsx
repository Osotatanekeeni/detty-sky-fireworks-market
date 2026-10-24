import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Calendar, MapPin, MessageCircle, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminField, PageHeader, Panel, adminInput, adminTextarea } from "@/components/admin/ui";
import { formatDate } from "@/components/site/forms";
import { Button } from "@/components/ui/button";
import { convertQuoteToOrder, updateQuote } from "@/lib/actions";
import { useCatalogue } from "@/lib/catalogue";
import { useDb } from "@/lib/mock-db";
import { formatNaira } from "@/lib/pricing";
import type { BulkQuote, QuoteStatus } from "@/lib/types";

export const Route = createFileRoute("/admin/quotes")({ component: Quotes });

const STATUSES: QuoteStatus[] = ["New", "Quoted", "Converted", "Closed"];
const tone: Record<QuoteStatus, string> = {
  New: "bg-magenta/15 text-magenta",
  Quoted: "bg-gold/15 text-gold",
  Converted: "bg-emerald/15 text-emerald",
  Closed: "bg-secondary text-muted-foreground",
};

function Quotes() {
  const { quotes } = useDb();
  const [filter, setFilter] = useState<QuoteStatus | "">("");
  const list = quotes.filter((q) => !filter || q.status === filter);
  const [selectedId, setSelectedId] = useState<string | null>(list[0]?.id ?? null);
  const selected = quotes.find((q) => q.id === selectedId);
  return (
    <div>
      <PageHeader
        title="Bulk quotes"
        description="Requests from churches, planners, hotels and clubs."
      />
      <div className="mb-4 flex flex-wrap gap-2 text-sm" role="group" aria-label="Filter by status">
        {(["", ...STATUSES] as const).map((s) => (
          <button
            key={s || "all"}
            onClick={() => setFilter(s)}
            aria-pressed={filter === s}
            className={`rounded-full border px-3 py-1.5 ${filter === s ? "border-gold bg-gold/15 text-gold" : "border-border"}`}
          >
            {s || "All"} ({s ? quotes.filter((q) => q.status === s).length : quotes.length})
          </button>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Panel className="p-2">
          <ul className="space-y-1">
            {list.map((q) => (
              <li key={q.id}>
                <button
                  onClick={() => setSelectedId(q.id)}
                  aria-current={q.id === selectedId}
                  className={`w-full rounded-xl p-3 text-left ${q.id === selectedId ? "bg-secondary" : "hover:bg-secondary/50"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{q.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${tone[q.status]}`}
                    >
                      {q.status}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{q.request}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {q.orgType} · {q.city} · event {formatDate(q.eventDate)}
                  </p>
                </button>
              </li>
            ))}
            {!list.length && (
              <p className="p-6 text-center text-sm text-muted-foreground">No quotes here.</p>
            )}
          </ul>
        </Panel>
        {selected ? (
          <QuoteDetail key={selected.id} q={selected} />
        ) : (
          <Panel>
            <p className="text-sm text-muted-foreground">Select a request.</p>
          </Panel>
        )}
      </div>
    </div>
  );
}

function QuoteDetail({ q }: { q: BulkQuote }) {
  const nav = useNavigate();
  const { zones } = useCatalogue();
  const [response, setResponse] = useState(q.response ?? "");
  const [amount, setAmount] = useState(q.quotedAmount ? String(q.quotedAmount) : "");
  useEffect(() => {
    setResponse(q.response ?? "");
    setAmount(q.quotedAmount ? String(q.quotedAmount) : "");
  }, [q.id, q.response, q.quotedAmount]);
  const amt = Number(amount.replace(/\D/g, "")) || 0;
  const wa = `https://wa.me/${q.phone.replace(/\D/g, "").replace(/^0/, "234")}?text=${encodeURIComponent(`Hi ${q.name}, thanks for your Detty Sky bulk request. ${response}${amt ? ` Total: ${formatNaira(amt)}.` : ""}`)}`;
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl">{q.name}</h2>
          <p className="text-sm text-muted-foreground">
            {q.orgType} · received {formatDate(q.createdAt)}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase ${tone[q.status]}`}>
          {q.status}
        </span>
      </div>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <p className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gold" />
          {formatDate(q.eventDate)}
        </p>
        <p className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-gold" />
          {q.city}, {q.state}
        </p>
        <a href={`tel:${q.phone}`} className="flex items-center gap-2 text-gold">
          <Phone className="h-4 w-4" />
          {q.phone}
        </a>
      </div>
      <div className="mt-4 rounded-xl bg-secondary/60 p-4 text-sm">
        <p className="font-semibold">{q.request}</p>
        <p className="mt-1 text-muted-foreground">Quantity / budget: {q.quantity}</p>
        {q.notes && <p className="mt-2 text-muted-foreground">Notes: {q.notes}</p>}
        {q.email && <p className="mt-2 text-muted-foreground">Email: {q.email}</p>}
      </div>

      {q.status === "Converted" && q.orderId ? (
        <p className="mt-5 text-sm">
          Converted to order{" "}
          <Link
            to="/admin/orders/$id"
            params={{ id: q.orderId }}
            className="font-semibold text-gold underline"
          >
            {q.orderId}
          </Link>
          .
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          <AdminField
            label="Your quote"
            htmlFor="qr-resp"
            hint="What's included, delivery day, setup notes"
          >
            <textarea
              id="qr-resp"
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              className={adminTextarea}
            />
          </AdminField>
          <AdminField label="Quoted total (₦)" htmlFor="qr-amt">
            <input
              id="qr-amt"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`${adminInput} max-w-48`}
            />
          </AdminField>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="gold"
              disabled={!response.trim() || !amt}
              onClick={() => {
                updateQuote(q.id, {
                  status: "Quoted",
                  response: response.trim(),
                  quotedAmount: amt,
                });
                toast.success("Quote saved", {
                  description: q.email ? `Emailed to ${q.email} (demo)` : "Send it on WhatsApp too",
                });
              }}
            >
              Save & send quote
            </Button>
            <Button asChild variant="glass">
              <a href={wa} target="_blank" rel="noreferrer">
                <MessageCircle /> WhatsApp
              </a>
            </Button>
            {q.status === "Quoted" && (
              <Button
                variant="paystack"
                onClick={() => {
                  const o = convertQuoteToOrder(zones, q.id);
                  if (o) {
                    toast.success(`Order ${o.id} created — awaiting payment`);
                    nav({ to: "/admin/orders/$id", params: { id: o.id } });
                  }
                }}
              >
                Convert to order
              </Button>
            )}
            {q.status !== "Closed" && (
              <Button
                variant="ghost"
                onClick={() => {
                  updateQuote(q.id, { status: "Closed" });
                  toast("Quote closed");
                }}
              >
                Close
              </Button>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}
