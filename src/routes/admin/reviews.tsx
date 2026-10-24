import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck } from "lucide-react";
import { useState } from "react";
import { PageHeader, Panel } from "@/components/admin/ui";
import { Stars } from "@/components/site/ProductCard";
import { ReviewMediaThumb } from "@/components/site/ReviewMedia";
import { formatDate } from "@/components/site/forms";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listReviews, setReviewStatus } from "@/lib/admin.functions";
import { useAdminWrite } from "@/lib/admin-write";
import { useCatalogue } from "@/lib/catalogue";
import type { Review } from "@/lib/types";

export const Route = createFileRoute("/admin/reviews")({ component: Reviews });

const FILTERS: { id: Review["status"]; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Published" },
  { id: "hidden", label: "Hidden" },
];

function Reviews() {
  const { products } = useCatalogue();
  const qc = useQueryClient();
  const write = useAdminWrite();
  const { data: reviews = [], isPending } = useQuery({
    queryKey: ["admin", "reviews"],
    queryFn: () => listReviews(),
  });
  const setStatus = async (id: string, status: Review["status"]) => {
    await write(setReviewStatus({ data: { id, status } }), status === "approved" ? "Published" : "Hidden");
    await qc.invalidateQueries({ queryKey: ["admin", "reviews"] });
  };
  const [filter, setFilter] = useState<Review["status"]>("pending");
  const list = reviews.filter((r) => r.status === filter);
  return (
    <div>
      <PageHeader
        title="Reviews"
        description="Approve reviews before they go live. Only verified buyers can submit."
      />
      <div className="mb-4 flex gap-2 text-sm" role="group" aria-label="Filter reviews">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            className={`rounded-full border px-3 py-1.5 ${filter === f.id ? "border-gold bg-gold/15 text-gold" : "border-border"}`}
          >
            {f.label} ({reviews.filter((r) => r.status === f.id).length})
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {list.map((r) => {
          const p = products.find((x) => x.id === r.productId);
          return (
            <Panel key={r.id}>
              <div className="flex flex-wrap items-start gap-4">
                {p && <img src={p.image} alt="" className="h-12 w-12 rounded-lg object-cover" />}
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">{p?.name ?? "Deleted product"}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Stars value={r.rating} />
                    <span className="font-semibold">{r.title}</span>
                    {r.verified && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald">
                        <BadgeCheck className="h-3 w-3" /> Verified
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>
                  {r.media && (
                    <div className="mt-2 flex gap-2">
                      {r.media.map((m, i) => (
                        <ReviewMediaThumb key={i} m={m} poster={p?.image} className="h-14 w-14" />
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {r.author} · {r.city} · {formatDate(r.date)}
                    {r.orderId ? ` · order ${r.orderId}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  {r.status !== "approved" && (
                    <Button
                      variant="gold"
                      size="sm"
                      onClick={() => void setStatus(r.id, "approved")}
                    >
                      Publish
                    </Button>
                  )}
                  {r.status !== "hidden" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void setStatus(r.id, "hidden")}
                    >
                      Hide
                    </Button>
                  )}
                </div>
              </div>
            </Panel>
          );
        })}
        {!list.length && (
          <Panel>
            <p className="py-6 text-center text-sm text-muted-foreground">
              {isPending ? "Loading…" : "Nothing here. 🎉"}
            </p>
          </Panel>
        )}
      </div>
    </div>
  );
}
