import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AdminField,
  PageHeader,
  Panel,
  TableWrap,
  Toggle,
  adminInput,
  td,
  th,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteCode, saveCode } from "@/lib/actions";
import {
  deleteBanner,
  deleteBundle,
  listBanners,
  newId,
  saveBanner,
  saveBundle,
  saveCampaign,
} from "@/lib/admin.functions";
import { useAdminWrite } from "@/lib/admin-write";
import { useCatalogue } from "@/lib/catalogue";
import { STOCK_IMAGES } from "@/lib/data";
import { useDb } from "@/lib/mock-db";
import { formatNaira } from "@/lib/pricing";
import type { Banner, Bundle } from "@/lib/types";

export const Route = createFileRoute("/admin/marketing")({ component: Marketing });

function Marketing() {
  return (
    <div>
      <PageHeader
        title="Marketing"
        description="Campaign, discount codes, homepage banners and bundles."
      />
      <Tabs defaultValue="campaign">
        <TabsList className="mb-4 flex h-auto flex-wrap justify-start">
          <TabsTrigger value="campaign">Campaign</TabsTrigger>
          <TabsTrigger value="codes">Discount codes</TabsTrigger>
          <TabsTrigger value="banners">Banners</TabsTrigger>
          <TabsTrigger value="bundles">Bundles</TabsTrigger>
        </TabsList>
        <TabsContent value="campaign">
          <CampaignTab />
        </TabsContent>
        <TabsContent value="codes">
          <CodesTab />
        </TabsContent>
        <TabsContent value="banners">
          <BannersTab />
        </TabsContent>
        <TabsContent value="bundles">
          <BundlesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CampaignTab() {
  const { campaign } = useCatalogue();
  const write = useAdminWrite();
  const [c, setC] = useState(campaign);
  return (
    <Panel title="December campaign" className="max-w-2xl">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void write(saveCampaign({ data: c }), "Campaign updated");
        }}
      >
        <AdminField label="Announcement bar" htmlFor="c-ann" hint="Leave empty to hide the bar">
          <input
            id="c-ann"
            value={c.announcement}
            onChange={(e) => setC({ ...c, announcement: e.target.value })}
            className={adminInput}
          />
        </AdminField>
        <AdminField
          label="Countdown label"
          htmlFor="c-cd"
          hint="Shown above the New Year countdown on the homepage"
        >
          <input
            id="c-cd"
            value={c.countdownLabel}
            onChange={(e) => setC({ ...c, countdownLabel: e.target.value })}
            className={adminInput}
          />
        </AdminField>
        <label className="flex items-center gap-3 text-sm">
          <Toggle
            checked={c.preordersOpen}
            onChange={(v) => setC({ ...c, preordersOpen: v })}
            label="Pre-orders open"
          />{" "}
          Pre-orders open — when off, pre-order products can't be added to cart
        </label>
        <Button type="submit" variant="gold">
          Save campaign
        </Button>
      </form>
    </Panel>
  );
}

function CodesTab() {
  const { codes } = useDb();
  const [code, setCode] = useState("");
  const [pct, setPct] = useState("10");
  return (
    <div className="space-y-6">
      <Panel title="New code" className="max-w-2xl">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const c = code.trim().toUpperCase();
            const p = Number(pct);
            if (!/^[A-Z0-9]{3,20}$/.test(c)) {
              toast.error("Use 3–20 letters or numbers");
              return;
            }
            if (!(p > 0 && p <= 50)) {
              toast.error("Discount must be 1–50%");
              return;
            }
            if (codes.some((x) => x.code === c)) {
              toast.error("That code already exists");
              return;
            }
            saveCode({ code: c, pct: p, active: true, uses: 0 });
            setCode("");
            toast.success(`${c} created`);
          }}
        >
          <AdminField label="Code" htmlFor="dc-code">
            <input
              id="dc-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="CROSSOVER15"
              className={`${adminInput} w-48 uppercase`}
            />
          </AdminField>
          <AdminField label="% off" htmlFor="dc-pct">
            <input
              id="dc-pct"
              inputMode="numeric"
              value={pct}
              onChange={(e) => setPct(e.target.value)}
              className={`${adminInput} w-20`}
            />
          </AdminField>
          <Button type="submit" variant="gold">
            <Plus /> Create
          </Button>
        </form>
      </Panel>
      <Panel>
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>Code</th>
              <th className={th}>Discount</th>
              <th className={th}>Uses</th>
              <th className={th}>Active</th>
              <th className={th}>
                <span className="sr-only">Delete</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {codes.map((c) => (
              <tr key={c.code}>
                <td className={`${td} font-mono font-semibold`}>{c.code}</td>
                <td className={td}>{c.pct}%</td>
                <td className={td}>{c.uses}</td>
                <td className={td}>
                  <Toggle
                    checked={c.active}
                    onChange={(v) => saveCode({ ...c, active: v })}
                    label={`${c.code} active`}
                  />
                </td>
                <td className={`${td} text-right`}>
                  <button
                    aria-label={`Delete ${c.code}`}
                    onClick={() => {
                      deleteCode(c.code);
                      toast(`${c.code} deleted`);
                    }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Panel>
    </div>
  );
}

function BannersTab() {
  // The catalogue only has live banners; admin needs the switched-off ones too.
  const qc = useQueryClient();
  const write = useAdminWrite();
  const { data: banners = [] } = useQuery({ queryKey: ["admin", "banners"], queryFn: () => listBanners() });
  const sortOf = (b: Banner) => {
    const i = banners.findIndex((x) => x.id === b.id);
    return i >= 0 ? i : banners.length;
  };
  const run = async (work: Promise<unknown>, msg: string) => {
    const ok = await write(work, msg);
    await qc.invalidateQueries({ queryKey: ["admin", "banners"] });
    return ok;
  };
  const [editing, setEditing] = useState<Banner | null>(null);
  return (
    <div className="space-y-4">
      <Button
        variant="gold"
        onClick={() =>
          setEditing({
            id: newId(),
            title: "",
            subtitle: "",
            cta: "Shop now",
            href: "/shop",
            tone: "party",
            active: true,
          })
        }
      >
        <Plus /> New banner
      </Button>
      {editing && (
        <Panel
          title={banners.some((b) => b.id === editing.id) ? "Edit banner" : "New banner"}
          className="max-w-2xl"
        >
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!editing.title.trim()) {
                toast.error("Add a title");
                return;
              }
              if (!editing.href.startsWith("/")) {
                toast.error("Link must start with / (a page on this site)");
                return;
              }
              if (await run(saveBanner({ data: { banner: editing, sort: sortOf(editing) } }), "Banner saved"))
                setEditing(null);
            }}
          >
            <AdminField label="Title" htmlFor="bn-t">
              <input
                id="bn-t"
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                className={adminInput}
              />
            </AdminField>
            <AdminField label="Subtitle" htmlFor="bn-s">
              <input
                id="bn-s"
                value={editing.subtitle}
                onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })}
                className={adminInput}
              />
            </AdminField>
            <div className="grid gap-4 sm:grid-cols-3">
              <AdminField label="Button text" htmlFor="bn-c">
                <input
                  id="bn-c"
                  value={editing.cta}
                  onChange={(e) => setEditing({ ...editing, cta: e.target.value })}
                  className={adminInput}
                />
              </AdminField>
              <AdminField label="Link" htmlFor="bn-h" hint="e.g. /shop?occasion=birthday">
                <input
                  id="bn-h"
                  value={editing.href}
                  onChange={(e) => setEditing({ ...editing, href: e.target.value })}
                  className={adminInput}
                />
              </AdminField>
              <AdminField label="Style" htmlFor="bn-tone">
                <select
                  id="bn-tone"
                  value={editing.tone}
                  onChange={(e) =>
                    setEditing({ ...editing, tone: e.target.value as Banner["tone"] })
                  }
                  className={adminInput}
                >
                  <option value="party">Party gradient</option>
                  <option value="gold">Gold</option>
                  <option value="royal">Royal night</option>
                </select>
              </AdminField>
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="gold">
                Save
              </Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </Panel>
      )}
      {banners.map((b) => (
        <Panel key={b.id}>
          <div className="flex flex-wrap items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{b.title}</p>
              <p className="text-sm text-muted-foreground">{b.subtitle}</p>
              <p className="mt-1 text-xs text-gold">
                {b.cta} → {b.href}
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <Toggle
                checked={b.active}
                onChange={(v) =>
                  void run(saveBanner({ data: { banner: { ...b, active: v }, sort: sortOf(b) } }), v ? "Banner live" : "Banner off")
                }
                label={`${b.title} visible`}
              />{" "}
              {b.active ? "Live" : "Off"}
            </label>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Edit ${b.title}`}
              onClick={() => setEditing(b)}
            >
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Delete ${b.title}`}
              onClick={() => void run(deleteBanner({ data: b.id }), "Banner deleted")}
            >
              <Trash2 />
            </Button>
          </div>
        </Panel>
      ))}
    </div>
  );
}

function BundlesTab() {
  const { bundles, products } = useCatalogue();
  const write = useAdminWrite();
  const [editing, setEditing] = useState<Bundle | null>(null);
  const valueOf = (b: Bundle) =>
    b.items.reduce(
      (s, i) => s + (products.find((p) => p.id === i.productId)?.price ?? 0) * i.qty,
      0,
    );
  const slugify = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  return (
    <div className="space-y-4">
      <Button
        variant="gold"
        onClick={() =>
          setEditing({
            id: newId(),
            slug: "",
            name: "",
            tagline: "",
            image: STOCK_IMAGES[0]!.src,
            items: [],
            price: 0,
          })
        }
      >
        <Plus /> New bundle
      </Button>
      {editing &&
        (() => {
          const value = valueOf(editing);
          return (
            <Panel
              title={bundles.some((b) => b.id === editing.id) ? "Edit bundle" : "New bundle"}
              className="max-w-3xl"
            >
              <form
                className="space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!editing.name.trim() || !editing.items.length) {
                    toast.error("Add a name and at least one product");
                    return;
                  }
                  if (editing.price <= 0 || editing.price >= value) {
                    toast.error("Bundle price must be below the items' total value");
                    return;
                  }
                  const out = { ...editing, slug: editing.slug || slugify(editing.name) };
                  if (await write(saveBundle({ data: out }), "Bundle saved")) setEditing(null);
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <AdminField label="Name" htmlFor="bd-n">
                    <input
                      id="bd-n"
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      className={adminInput}
                    />
                  </AdminField>
                  <AdminField label="Tagline" htmlFor="bd-t">
                    <input
                      id="bd-t"
                      value={editing.tagline}
                      onChange={(e) => setEditing({ ...editing, tagline: e.target.value })}
                      className={adminInput}
                    />
                  </AdminField>
                </div>
                <fieldset>
                  <legend className="mb-1 text-xs font-semibold text-muted-foreground">
                    Image
                  </legend>
                  <div className="flex gap-2">
                    {STOCK_IMAGES.map((img) => (
                      <button
                        type="button"
                        key={img.src}
                        aria-label={img.label}
                        aria-pressed={editing.image === img.src}
                        onClick={() => setEditing({ ...editing, image: img.src })}
                        className={`h-14 w-14 overflow-hidden rounded-lg border-2 ${editing.image === img.src ? "border-gold" : "border-transparent"}`}
                      >
                        <img src={img.src} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="space-y-2">
                  <legend className="mb-1 text-xs font-semibold text-muted-foreground">
                    What's inside
                  </legend>
                  {editing.items.map((it, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        aria-label="Quantity"
                        inputMode="numeric"
                        value={it.qty}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            items: editing.items.map((x, j) =>
                              j === i ? { ...x, qty: Math.max(1, Number(e.target.value) || 1) } : x,
                            ),
                          })
                        }
                        className={`${adminInput} w-16`}
                      />
                      <span className="text-muted-foreground">×</span>
                      <select
                        aria-label="Product"
                        value={it.productId}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            items: editing.items.map((x, j) =>
                              j === i ? { ...x, productId: e.target.value } : x,
                            ),
                          })
                        }
                        className={adminInput}
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} — {formatNaira(p.price)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        aria-label="Remove item"
                        onClick={() =>
                          setEditing({ ...editing, items: editing.items.filter((_, j) => j !== i) })
                        }
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      products[0] &&
                      setEditing({
                        ...editing,
                        items: [...editing.items, { productId: products[0].id, qty: 1 }],
                      })
                    }
                  >
                    <Plus /> Add product
                  </Button>
                </fieldset>
                <div className="flex flex-wrap items-end gap-4">
                  <AdminField label="Bundle price (₦)" htmlFor="bd-p">
                    <input
                      id="bd-p"
                      inputMode="numeric"
                      value={editing.price || ""}
                      onChange={(e) =>
                        setEditing({ ...editing, price: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className={`${adminInput} w-40`}
                    />
                  </AdminField>
                  <p className="pb-2 text-sm text-muted-foreground">
                    Items worth {formatNaira(value)}
                    {editing.price > 0 && editing.price < value && (
                      <span className="text-emerald">
                        {" "}
                        · customer saves {formatNaira(value - editing.price)} (
                        {Math.round((1 - editing.price / value) * 100)}%)
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" variant="gold">
                    Save bundle
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Panel>
          );
        })()}
      <div className="grid gap-4 md:grid-cols-2">
        {bundles.map((b) => {
          const value = valueOf(b);
          return (
            <Panel key={b.id}>
              <div className="flex gap-4">
                <img src={b.image} alt="" className="h-20 w-20 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{b.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.items.length} products · worth {formatNaira(value)}
                  </p>
                  <p className="mt-1 font-display text-gold">
                    {formatNaira(b.price)}{" "}
                    <span className="text-xs text-emerald">
                      save {formatNaira(value - b.price)}
                    </span>
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Edit ${b.name}`}
                    onClick={() => setEditing(b)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Delete ${b.name}`}
                    onClick={() => void write(deleteBundle({ data: b.id }), "Bundle deleted")}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
