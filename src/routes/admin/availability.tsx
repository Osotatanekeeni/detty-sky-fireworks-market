import { createFileRoute } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { PageHeader, Panel, Toggle } from "@/components/admin/ui";
import { toggleCategoryBlock } from "@/lib/admin.functions";
import { useAdminWrite } from "@/lib/admin-write";
import { useCatalogue } from "@/lib/catalogue";
import { CATEGORIES, STATES } from "@/lib/data";

export const Route = createFileRoute("/admin/availability")({ component: Availability });

function Availability() {
  const { blocks } = useCatalogue();
  const write = useAdminWrite();
  const total = Object.values(blocks).reduce((s, b) => s + (b?.length ?? 0), 0);
  return (
    <div>
      <PageHeader
        title="State availability"
        description="The kill switch. Turn a category off in a state when local authorities restrict it — customers delivering there can't buy it, and checkout blocks it."
      />
      <div className="mb-4 flex items-start gap-3 rounded-2xl border border-ember/40 bg-ember/10 p-4 text-sm">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-ember" />
        <p>
          {total
            ? `${total} category ${total === 1 ? "restriction is" : "restrictions are"} active.`
            : "No restrictions active."}{" "}
          Changes apply instantly to product pages, the cart and checkout. Orders already paid
          aren't affected — check them on the Orders page.
        </p>
      </div>
      <Panel>
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr>
                <th className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Category
                </th>
                {STATES.map((s) => (
                  <th
                    key={s}
                    className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground"
                  >
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((c) => (
                <tr key={c.slug} className="border-t border-border">
                  <th scope="row" className="py-3 pr-4 text-left font-semibold">
                    {c.name}
                  </th>
                  {STATES.map((s) => {
                    const on = !(blocks[s] ?? []).includes(c.slug);
                    return (
                      <td key={s} className="px-2 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Toggle
                            checked={on}
                            label={`${c.name} in ${s}`}
                            onChange={() => {
                              void write(
                                toggleCategoryBlock({ data: { state: s, category: c.slug } }),
                                on ? `${c.name} disabled in ${s}` : `${c.name} enabled in ${s}`,
                              );
                            }}
                          />
                          <span
                            className={`text-[10px] font-semibold uppercase ${on ? "text-muted-foreground" : "text-destructive"}`}
                          >
                            {on ? "On" : "Off"}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
