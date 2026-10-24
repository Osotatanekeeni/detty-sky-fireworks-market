import { createFileRoute } from "@tanstack/react-router";
import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader, Panel, TableWrap, adminInput, td, th } from "@/components/admin/ui";
import { setStock } from "@/lib/admin.functions";
import { useAdminWrite } from "@/lib/admin-write";
import { useCatalogue } from "@/lib/catalogue";
import { getCategory } from "@/lib/services";
import { formatArrives } from "@/lib/db-map";

export const Route = createFileRoute("/admin/inventory")({ component: Inventory });

function Inventory() {
  const { products } = useCatalogue();
  const write = useAdminWrite();
  const save = (id: string, patch: { stock?: number; lowStockThreshold?: number }) =>
    void write(setStock({ data: { id, ...patch } }));
  const [lowOnly, setLowOnly] = useState(false);
  const isLow = (p: (typeof products)[number]) => !p.preorder && p.stock < p.lowStockThreshold;
  const list = [...products]
    .filter((p) => !lowOnly || isLow(p))
    .sort((a, b) => Number(isLow(b)) - Number(isLow(a)) || a.stock - b.stock);
  const lowCount = products.filter(isLow).length;
  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Stock goes down when an order is paid. Pre-order items aren't limited by stock."
      />
      <div className="mb-4 flex gap-2 text-sm" role="group" aria-label="Filter">
        <button
          onClick={() => setLowOnly(false)}
          aria-pressed={!lowOnly}
          className={`rounded-full border px-3 py-1.5 ${!lowOnly ? "border-gold bg-gold/15 text-gold" : "border-border"}`}
        >
          All ({products.length})
        </button>
        <button
          onClick={() => setLowOnly(true)}
          aria-pressed={lowOnly}
          className={`rounded-full border px-3 py-1.5 ${lowOnly ? "border-gold bg-gold/15 text-gold" : "border-border"}`}
        >
          Low stock ({lowCount})
        </button>
      </div>
      <Panel>
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>Product</th>
              <th className={th}>Category</th>
              <th className={th}>In stock</th>
              <th className={th}>Alert below</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td className={`${td} font-semibold`}>{p.name}</td>
                <td className={td}>{getCategory(p.category)?.name}</td>
                <td className={td}>
                  <div className="flex items-center gap-1">
                    <button
                      aria-label={`Decrease ${p.name} stock`}
                      onClick={() => save(p.id, { stock: Math.max(0, p.stock - 1) })}
                      className="rounded-md border border-border p-1.5 hover:bg-secondary"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <NumberCell
                      label={`${p.name} stock`}
                      value={p.stock}
                      onCommit={(stock) => save(p.id, { stock })}
                    />
                    <button
                      aria-label={`Increase ${p.name} stock`}
                      onClick={() => save(p.id, { stock: p.stock + 1 })}
                      className="rounded-md border border-border p-1.5 hover:bg-secondary"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </td>
                <td className={td}>
                  <NumberCell
                    label={`${p.name} low-stock threshold`}
                    value={p.lowStockThreshold}
                    onCommit={(lowStockThreshold) => save(p.id, { lowStockThreshold })}
                  />
                </td>
                <td className={td}>
                  {p.preorder ? (
                    <span className="text-xs">Pre-order · {formatArrives(p.preorder.arrives)}</span>
                  ) : p.stock === 0 ? (
                    <span className="text-xs font-semibold text-destructive">Out of stock</span>
                  ) : isLow(p) ? (
                    <span className="text-xs font-semibold text-ember">Low</span>
                  ) : (
                    <span className="text-xs text-emerald">OK</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Panel>
    </div>
  );
}

/** A number input that saves on blur or Enter (not on every keystroke). */
function NumberCell({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (v: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const v = Math.max(0, Math.floor(Number(draft) || 0));
    if (v !== value) onCommit(v);
    else setDraft(String(value));
  };
  return (
    <input
      aria-label={label}
      inputMode="numeric"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className={`${adminInput} h-8 w-20 text-center`}
    />
  );
}
