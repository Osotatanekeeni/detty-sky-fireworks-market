import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader, Panel, adminInput } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { saveZone } from "@/lib/admin.functions";
import { useAdminWrite } from "@/lib/admin-write";
import { useCatalogue } from "@/lib/catalogue";
import type { City, DeliveryZone } from "@/lib/types";

export const Route = createFileRoute("/admin/delivery")({ component: DeliveryZones });

function DeliveryZones() {
  const { zones } = useCatalogue();
  return (
    <div>
      <PageHeader
        title="Delivery zones"
        description="Fees and delivery days per city. Checkout and the Delivery page use these immediately."
      />
      <div className="grid gap-6 xl:grid-cols-2">
        {zones.map((z) => (
          <ZoneEditor key={z.state} zone={z} />
        ))}
      </div>
    </div>
  );
}

function ZoneEditor({ zone }: { zone: DeliveryZone }) {
  const [cities, setCities] = useState<City[]>(zone.cities);
  const [saving, setSaving] = useState(false);
  const write = useAdminWrite();
  // Order-insensitive: the database returns cities sorted by fee.
  const key = (cs: City[]) => JSON.stringify([...cs].sort((a, b) => a.name.localeCompare(b.name)));
  const dirty = key(cities) !== key(zone.cities);
  const set = (i: number, patch: Partial<City>) =>
    setCities((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const save = async () => {
    const clean = cities.filter((c) => c.name.trim()).map((c) => ({ ...c, name: c.name.trim() }));
    if (new Set(clean.map((c) => c.name.toLowerCase())).size !== clean.length) {
      toast.error("Two cities have the same name");
      return;
    }
    setSaving(true);
    if (await write(saveZone({ data: { ...zone, cities: clean } }), `${zone.state} delivery saved`))
      setCities(clean);
    setSaving(false);
  };
  return (
    <Panel
      title={zone.state}
      action={dirty ? <span className="text-xs text-ember">Unsaved changes</span> : undefined}
    >
      <div className="grid grid-cols-[1fr_96px_72px_28px] gap-2 text-xs font-semibold text-muted-foreground">
        <span>City / LGA</span>
        <span>Fee (₦)</span>
        <span>Days</span>
        <span />
      </div>
      <div className="mt-2 space-y-2">
        {cities.map((c, i) => (
          <div key={i} className="grid grid-cols-[1fr_96px_72px_28px] items-center gap-2">
            <input
              aria-label="City name"
              value={c.name}
              onChange={(e) => set(i, { name: e.target.value })}
              className={`${adminInput} h-9`}
            />
            <input
              aria-label={`${c.name} delivery fee`}
              inputMode="numeric"
              value={c.fee}
              onChange={(e) => set(i, { fee: Math.max(0, Number(e.target.value) || 0) })}
              className={`${adminInput} h-9`}
            />
            <input
              aria-label={`${c.name} delivery days`}
              inputMode="numeric"
              value={c.days}
              onChange={(e) => set(i, { days: Math.max(1, Number(e.target.value) || 1) })}
              className={`${adminInput} h-9`}
            />
            <button
              aria-label={`Remove ${c.name}`}
              onClick={() => setCities((cs) => cs.filter((_, j) => j !== i))}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCities((cs) => [...cs, { name: "", fee: 5000, days: 3 }])}
        >
          <Plus /> Add city
        </Button>
        <Button variant="gold" size="sm" className="ml-auto" disabled={!dirty} onClick={save}>
          Save
        </Button>
      </div>
    </Panel>
  );
}
