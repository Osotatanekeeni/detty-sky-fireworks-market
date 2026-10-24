import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Panel, PageHeader, Stat, TableWrap, td, th } from "@/components/admin/ui";
import { formatDate } from "@/components/site/forms";
import { StatusPill } from "@/components/site/OrderTimeline";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { STATES } from "@/lib/data";
import { useQuery } from "@tanstack/react-query";
import { listReviews } from "@/lib/admin.functions";
import { useCatalogue } from "@/lib/catalogue";
import { useDb } from "@/lib/mock-db";
import { formatNaira } from "@/lib/pricing";

export const Route = createFileRoute("/admin/")({ component: Dashboard });

const chartConfig = { revenue: { label: "Revenue", color: "var(--gold)" } } satisfies ChartConfig;
const shortNaira = (n: number) =>
  n >= 1e6 ? `₦${(n / 1e6).toFixed(1)}m` : n >= 1e3 ? `₦${Math.round(n / 1e3)}k` : `₦${n}`;

function Dashboard() {
  const { orders, quotes } = useDb();
  const { products } = useCatalogue();
  const { data: reviews = [] } = useQuery({ queryKey: ["admin", "reviews"], queryFn: () => listReviews() });
  const paid = orders.filter((o) => o.payment?.status !== "pending");
  const revenue = paid.reduce((s, o) => s + o.total, 0);
  const toFulfil = orders.filter((o) => o.status !== "Delivered");
  const byState = STATES.map((st) => {
    const os = paid.filter((o) => o.address.state === st);
    return { state: st, revenue: os.reduce((s, o) => s + o.total, 0), orders: os.length };
  });
  const sold = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const o of paid)
    for (const l of o.lines) {
      const cur = sold.get(l.productId) ?? { name: l.name, qty: 0, revenue: 0 };
      sold.set(l.productId, {
        name: l.name,
        qty: cur.qty + l.qty,
        revenue: cur.revenue + l.qty * l.unitPrice,
      });
    }
  const top = [...sold.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const low = products
    .filter((p) => !p.preorder && p.stock < p.lowStockThreshold)
    .sort((a, b) => a.stock - b.stock);
  const newQuotes = quotes.filter((q) => q.status === "New").length;
  const pendingReviews = reviews.filter((r) => r.status === "pending").length;

  return (
    <div>
      <PageHeader title="Dashboard" description="How the store is doing right now." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Revenue" value={formatNaira(revenue)} sub={`${paid.length} paid orders`} />
        <Stat
          label="To fulfil"
          value={String(toFulfil.length)}
          sub={`${orders.filter((o) => o.status === "Processing").length} still processing`}
          tone="magenta"
        />
        <Stat
          label="Avg order value"
          value={formatNaira(paid.length ? revenue / paid.length : 0)}
          tone="emerald"
        />
        <Stat
          label="Needs attention"
          value={String(newQuotes + pendingReviews + low.length)}
          sub={`${newQuotes} new ${newQuotes === 1 ? "quote" : "quotes"} · ${pendingReviews} ${pendingReviews === 1 ? "review" : "reviews"} · ${low.length} low stock`}
          tone="ember"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Revenue by state">
          <ChartContainer config={chartConfig} className="h-64 w-full">
            <BarChart data={byState} margin={{ left: 4, right: 4, top: 8 }}>
              <CartesianGrid vertical={false} strokeOpacity={0.4} />
              <XAxis
                dataKey="state"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={11}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={52}
                fontSize={11}
                tickFormatter={shortNaira}
              />
              <ChartTooltip
                cursor={{ fillOpacity: 0.08 }}
                content={
                  <ChartTooltipContent
                    formatter={(v, _n, item) => (
                      <span className="flex w-full justify-between gap-4">
                        <span className="text-muted-foreground">{item.payload.orders} orders</span>
                        <span className="font-semibold">{formatNaira(Number(v))}</span>
                      </span>
                    )}
                  />
                }
              />
              <Bar
                dataKey="revenue"
                fill="var(--color-revenue)"
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
              />
            </BarChart>
          </ChartContainer>
          <table className="sr-only">
            <caption>Revenue by state</caption>
            <tbody>
              {byState.map((b) => (
                <tr key={b.state}>
                  <th>{b.state}</th>
                  <td>{formatNaira(b.revenue)}</td>
                  <td>{b.orders} orders</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Top products">
          <ol className="space-y-3">
            {top.map((t, i) => (
              <li key={t.name} className="flex items-center gap-3 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold">
                  {i + 1}
                </span>
                <span className="flex-1 truncate">{t.name}</span>
                <span className="text-muted-foreground">{t.qty} sold</span>
                <span className="w-24 text-right font-semibold">{formatNaira(t.revenue)}</span>
              </li>
            ))}
            {!top.length && <p className="text-sm text-muted-foreground">No sales yet.</p>}
          </ol>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel
          title="Recent orders"
          action={
            <Link to="/admin/orders" className="text-xs text-gold">
              All orders →
            </Link>
          }
        >
          <TableWrap>
            <thead>
              <tr>
                <th className={th}>Order</th>
                <th className={th}>Customer</th>
                <th className={th}>State</th>
                <th className={th}>Status</th>
                <th className={`${th} text-right`}>Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 6).map((o) => (
                <tr key={o.id}>
                  <td className={td}>
                    <Link
                      to="/admin/orders/$id"
                      params={{ id: o.id }}
                      className="font-semibold text-gold hover:underline"
                    >
                      {o.id}
                    </Link>
                    <div className="text-xs text-muted-foreground">{formatDate(o.createdAt)}</div>
                  </td>
                  <td className={td}>{o.customer.name}</td>
                  <td className={td}>{o.address.state}</td>
                  <td className={td}>
                    <StatusPill status={o.status} />
                  </td>
                  <td className={`${td} text-right font-semibold`}>{formatNaira(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </Panel>

        <Panel
          title="Low stock"
          action={
            <Link to="/admin/inventory" className="text-xs text-gold">
              Inventory →
            </Link>
          }
        >
          {low.length ? (
            <ul className="space-y-2">
              {low.map((p) => (
                <li key={p.id} className="flex items-center gap-3 text-sm">
                  <AlertTriangle
                    className={`h-4 w-4 ${p.stock === 0 ? "text-destructive" : "text-ember"}`}
                    aria-hidden
                  />
                  <span className="flex-1 truncate">{p.name}</span>
                  <span
                    className={`font-semibold ${p.stock === 0 ? "text-destructive" : "text-ember"}`}
                  >
                    {p.stock === 0 ? "Out of stock" : `${p.stock} left`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Everything is well stocked.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
