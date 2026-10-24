import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";
import { PageHeader, Panel, TableWrap, adminInput, td, th } from "@/components/admin/ui";
import { formatDate } from "@/components/site/forms";
import { StatusPill } from "@/components/site/OrderTimeline";
import { STATES } from "@/lib/data";
import { useDb } from "@/lib/mock-db";
import { formatNaira } from "@/lib/pricing";
import type { OrderStatus, StateName } from "@/lib/types";

export const Route = createFileRoute("/admin/orders/")({ component: Orders });

const STATUSES: OrderStatus[] = ["Processing", "Dispatched", "Out for Delivery", "Delivered"];

function Orders() {
  const { orders } = useDb();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [state, setState] = useState<StateName | "">("");
  const list = orders.filter(
    (o) =>
      (!status || o.status === status) &&
      (!state || o.address.state === state) &&
      (!q ||
        `${o.id} ${o.customer.name} ${o.customer.phone} ${o.customer.email}`
          .toLowerCase()
          .includes(q.toLowerCase())),
  );
  return (
    <div>
      <PageHeader
        title="Orders"
        description="Update a delivery status and the customer's tracking timeline updates with it."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            aria-label="Search orders"
            placeholder="Order no., name, phone or email"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={`${adminInput} pl-9`}
          />
        </div>
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => setStatus(e.target.value as OrderStatus | "")}
          className={`${adminInput} w-auto`}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          aria-label="Filter by state"
          value={state}
          onChange={(e) => setState(e.target.value as StateName | "")}
          className={`${adminInput} w-auto`}
        >
          <option value="">All states</option>
          {STATES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <Panel>
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>Order</th>
              <th className={th}>Customer</th>
              <th className={th}>Deliver to</th>
              <th className={th}>Payment</th>
              <th className={th}>Status</th>
              <th className={`${th} text-right`}>Total</th>
            </tr>
          </thead>
          <tbody>
            {list.map((o) => (
              <tr key={o.id} className="hover:bg-secondary/40">
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
                <td className={td}>
                  {o.customer.name}
                  <div className="text-xs text-muted-foreground">{o.customer.phone}</div>
                </td>
                <td className={td}>
                  {o.address.city}
                  <div className="text-xs text-muted-foreground">{o.address.state}</div>
                </td>
                <td className={td}>
                  {o.payment?.status === "pending" ? (
                    <span className="text-xs font-semibold text-ember">Awaiting payment</span>
                  ) : (
                    <span className="text-xs text-emerald">Paid</span>
                  )}
                </td>
                <td className={td}>
                  <StatusPill status={o.status} />
                </td>
                <td className={`${td} text-right font-semibold`}>{formatNaira(o.total)}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
        {!list.length && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No orders match those filters.
          </p>
        )}
      </Panel>
    </div>
  );
}
