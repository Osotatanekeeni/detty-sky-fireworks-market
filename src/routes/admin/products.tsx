import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AdminField,
  PageHeader,
  Panel,
  TableWrap,
  Toggle,
  adminInput,
  adminTextarea,
  td,
  th,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CATEGORIES, OCCASIONS, STOCK_IMAGES } from "@/lib/data";
import { deleteProduct, newId, saveProduct } from "@/lib/admin.functions";
import { useAdminWrite } from "@/lib/admin-write";
import { useCatalogue } from "@/lib/catalogue";
import { DEFAULT_TIERS, formatNaira } from "@/lib/pricing";
import { getCategory } from "@/lib/services";
import type { CategorySlug, NoiseLevel, Product } from "@/lib/types";
import { formatArrives } from "@/lib/db-map";

export const Route = createFileRoute("/admin/products")({ component: Products });

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const blank = (): Product => ({
  id: newId(),
  slug: "",
  name: "",
  category: "aerial-cakes",
  occasions: [],
  price: 0,
  image: STOCK_IMAGES[0]!.src,
  gallery: [STOCK_IMAGES[0]!.src],
  videoPoster: STOCK_IMAGES[0]!.src,
  durationSec: 30,
  shots: 25,
  heightM: 25,
  noise: "Medium",
  colours: [],
  description: "",
  stock: 0,
  lowStockThreshold: 10,
  tiers: DEFAULT_TIERS,
});

function Products() {
  const { products } = useCatalogue();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<CategorySlug | "">("");
  const [editing, setEditing] = useState<Product | null>(null);
  const list = products.filter(
    (p) => (!cat || p.category === cat) && (!q || p.name.toLowerCase().includes(q.toLowerCase())),
  );
  return (
    <div>
      <PageHeader
        title="Products"
        description={`${products.length} products in the catalogue`}
        actions={
          <Button variant="gold" onClick={() => setEditing(blank())}>
            <Plus /> New product
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            aria-label="Search products"
            placeholder="Search by name"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={`${adminInput} pl-9`}
          />
        </div>
        <select
          aria-label="Filter by category"
          value={cat}
          onChange={(e) => setCat(e.target.value as CategorySlug | "")}
          className={`${adminInput} w-auto`}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <Panel>
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>Product</th>
              <th className={th}>Category</th>
              <th className={th}>Price</th>
              <th className={th}>Stock</th>
              <th className={th}>Flags</th>
              <th className={th}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="hover:bg-secondary/40">
                <td className={td}>
                  <div className="flex items-center gap-3">
                    <img src={p.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                    <span className="font-semibold">{p.name}</span>
                  </div>
                </td>
                <td className={td}>{getCategory(p.category)?.name}</td>
                <td className={td}>{formatNaira(p.price)}</td>
                <td
                  className={`${td} ${p.stock < p.lowStockThreshold && !p.preorder ? "font-semibold text-ember" : ""}`}
                >
                  {p.preorder ? "Pre-order" : p.stock}
                </td>
                <td className={td}>
                  <div className="flex flex-wrap gap-1 text-[10px] font-bold uppercase">
                    {p.bestSeller && (
                      <span className="rounded bg-gold/15 px-1.5 py-0.5 text-gold">
                        Best seller
                      </span>
                    )}
                    {p.preorder && (
                      <span className="rounded bg-royal/25 px-1.5 py-0.5">
                        Pre-order {formatArrives(p.preorder.arrives)}
                      </span>
                    )}
                  </div>
                </td>
                <td className={`${td} text-right`}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(p)}
                    aria-label={`Edit ${p.name}`}
                  >
                    <Pencil />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Panel>
      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent className="w-full overflow-y-auto bg-card sm:max-w-xl">
          {editing && (
            <ProductEditor
              initial={editing}
              isNew={!products.some((p) => p.id === editing.id)}
              onDone={() => setEditing(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ProductEditor({
  initial,
  isNew,
  onDone,
}: {
  initial: Product;
  isNew: boolean;
  onDone: () => void;
}) {
  const [p, setP] = useState<Product>(initial);
  const [colours, setColours] = useState(initial.colours.join(", "));
  const [preorder, setPreorder] = useState(initial.preorder?.arrives ?? "");
  const [error, setError] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const write = useAdminWrite();
  const set = (patch: Partial<Product>) => setP((x) => ({ ...x, ...patch }));
  const num = (v: string) => Math.max(0, Number(v) || 0);

  const save = async () => {
    if (p.name.trim().length < 3) return setError("Name is required");
    if (p.price <= 0) return setError("Price must be more than ₦0");
    const tiers = [...p.tiers]
      .filter((t) => t.minQty > 1 && t.discountPct > 0)
      .sort((a, b) => a.minQty - b.minQty);
    const { preorder: _old, ...rest } = p;
    const out: Product = {
      ...rest,
      name: p.name.trim(),
      slug: p.slug || slugify(p.name),
      tiers,
      colours: colours
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
      gallery: p.gallery.includes(p.image) ? p.gallery : [p.image, ...p.gallery],
      ...(preorder.trim() ? { preorder: { arrives: preorder.trim() } } : {}),
    };
    setBusy(true);
    const ok = await write(saveProduct({ data: out }), isNew ? "Product created" : "Product saved");
    setBusy(false);
    if (ok) onDone();
  };

  return (
    <div>
      <SheetHeader className="px-0">
        <SheetTitle>{isNew ? "New product" : `Edit ${initial.name}`}</SheetTitle>
        <SheetDescription>Changes show on the storefront straight away.</SheetDescription>
      </SheetHeader>
      <form
        className="mt-4 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <AdminField label="Name" htmlFor="pe-name">
          <input
            id="pe-name"
            value={p.name}
            onChange={(e) =>
              set({ name: e.target.value, ...(isNew ? { slug: slugify(e.target.value) } : {}) })
            }
            className={adminInput}
          />
        </AdminField>
        <div className="grid gap-4 sm:grid-cols-2">
          <AdminField label="Category" htmlFor="pe-cat">
            <select
              id="pe-cat"
              value={p.category}
              onChange={(e) => set({ category: e.target.value as CategorySlug })}
              className={adminInput}
            >
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </AdminField>
          <AdminField label="URL slug" htmlFor="pe-slug" hint={`/product/${p.slug || "…"}`}>
            <input
              id="pe-slug"
              value={p.slug}
              onChange={(e) => set({ slug: slugify(e.target.value) })}
              className={adminInput}
            />
          </AdminField>
        </div>
        <fieldset>
          <legend className="mb-1 text-xs font-semibold text-muted-foreground">Occasions</legend>
          <div className="flex flex-wrap gap-2">
            {OCCASIONS.map((o) => {
              const on = p.occasions.includes(o.slug);
              return (
                <button
                  type="button"
                  key={o.slug}
                  aria-pressed={on}
                  onClick={() =>
                    set({
                      occasions: on
                        ? p.occasions.filter((x) => x !== o.slug)
                        : [...p.occasions, o.slug],
                    })
                  }
                  className={`rounded-full border px-3 py-1 text-xs ${on ? "border-gold bg-gold/15 text-gold" : "border-border"}`}
                >
                  {o.emoji} {o.name}
                </button>
              );
            })}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-3">
          <AdminField label="Price (₦)" htmlFor="pe-price">
            <input
              id="pe-price"
              inputMode="numeric"
              value={p.price || ""}
              onChange={(e) => set({ price: num(e.target.value) })}
              className={adminInput}
            />
          </AdminField>
          <AdminField label="Compare-at (₦)" htmlFor="pe-cmp" hint="Shows struck through">
            <input
              id="pe-cmp"
              inputMode="numeric"
              value={p.compareAt ?? ""}
              onChange={(e) => {
                const v = num(e.target.value);
                setP(({ compareAt: _c, ...x }) => (v ? { ...x, compareAt: v } : x));
              }}
              className={adminInput}
            />
          </AdminField>
          <AdminField label="Stock" htmlFor="pe-stock">
            <input
              id="pe-stock"
              inputMode="numeric"
              value={p.stock}
              onChange={(e) => set({ stock: num(e.target.value) })}
              className={adminInput}
            />
          </AdminField>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <AdminField label="Duration (s)" htmlFor="pe-dur">
            <input
              id="pe-dur"
              inputMode="numeric"
              value={p.durationSec}
              onChange={(e) => set({ durationSec: num(e.target.value) })}
              className={adminInput}
            />
          </AdminField>
          <AdminField label="Shots" htmlFor="pe-shots">
            <input
              id="pe-shots"
              inputMode="numeric"
              value={p.shots}
              onChange={(e) => set({ shots: num(e.target.value) })}
              className={adminInput}
            />
          </AdminField>
          <AdminField label="Height (m)" htmlFor="pe-h">
            <input
              id="pe-h"
              inputMode="numeric"
              value={p.heightM}
              onChange={(e) => set({ heightM: num(e.target.value) })}
              className={adminInput}
            />
          </AdminField>
          <AdminField label="Noise" htmlFor="pe-noise">
            <select
              id="pe-noise"
              value={p.noise}
              onChange={(e) => set({ noise: e.target.value as NoiseLevel })}
              className={adminInput}
            >
              {(["Quiet", "Medium", "Loud"] as const).map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </AdminField>
        </div>
        <AdminField
          label="Effect colours"
          htmlFor="pe-col"
          hint="Comma separated, e.g. Gold, Magenta"
        >
          <input
            id="pe-col"
            value={colours}
            onChange={(e) => setColours(e.target.value)}
            className={adminInput}
          />
        </AdminField>
        <AdminField label="Description" htmlFor="pe-desc">
          <textarea
            id="pe-desc"
            value={p.description}
            onChange={(e) => set({ description: e.target.value })}
            className={adminTextarea}
          />
        </AdminField>

        <fieldset>
          <legend className="mb-1 text-xs font-semibold text-muted-foreground">Main image</legend>
          <div className="flex flex-wrap gap-2">
            {STOCK_IMAGES.map((img) => (
              <button
                type="button"
                key={img.src}
                onClick={() => set({ image: img.src, videoPoster: img.src })}
                aria-pressed={p.image === img.src}
                aria-label={img.label}
                className={`h-16 w-16 overflow-hidden rounded-lg border-2 ${p.image === img.src ? "border-gold" : "border-transparent"}`}
              >
                <img src={img.src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </fieldset>
        <div className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          <Upload className="mx-auto h-5 w-5" />
          <p className="mt-1">Product video & photo uploads go to Cloudflare R2 (Phase 3).</p>
          <label className="mt-2 inline-block cursor-pointer text-gold underline">
            Choose video
            <input
              type="file"
              accept="video/mp4,video/webm"
              className="sr-only"
              onChange={(e) =>
                e.target.files?.[0] &&
                toast(`"${e.target.files[0].name}" selected — uploads switch on in Phase 3`)
              }
            />
          </label>
        </div>

        <fieldset>
          <legend className="mb-1 text-xs font-semibold text-muted-foreground">
            Bulk price tiers
          </legend>
          <div className="space-y-2">
            {p.tiers.map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <input
                  aria-label="Minimum quantity"
                  inputMode="numeric"
                  value={t.minQty}
                  onChange={(e) =>
                    set({
                      tiers: p.tiers.map((x, j) =>
                        j === i ? { ...x, minQty: num(e.target.value) } : x,
                      ),
                    })
                  }
                  className={`${adminInput} w-20`}
                />
                <span className="text-muted-foreground">+ units →</span>
                <input
                  aria-label="Discount percent"
                  inputMode="numeric"
                  value={t.discountPct}
                  onChange={(e) =>
                    set({
                      tiers: p.tiers.map((x, j) =>
                        j === i ? { ...x, discountPct: Math.min(90, num(e.target.value)) } : x,
                      ),
                    })
                  }
                  className={`${adminInput} w-20`}
                />
                <span className="text-muted-foreground">% off</span>
                <button
                  type="button"
                  aria-label="Remove tier"
                  onClick={() => set({ tiers: p.tiers.filter((_, j) => j !== i) })}
                  className="ml-auto text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => set({ tiers: [...p.tiers, { minQty: 50, discountPct: 15 }] })}
            >
              <Plus /> Add tier
            </Button>
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <AdminField
            label="Pre-order arrival"
            htmlFor="pe-pre"
            hint="Leave empty for in-stock items"
          >
            <input
              id="pe-pre"
              type="date"
              value={preorder}
              onChange={(e) => setPreorder(e.target.value)}
              className={adminInput}
            />
          </AdminField>
          <AdminField label="Low-stock alert at" htmlFor="pe-low">
            <input
              id="pe-low"
              inputMode="numeric"
              value={p.lowStockThreshold}
              onChange={(e) => set({ lowStockThreshold: num(e.target.value) })}
              className={adminInput}
            />
          </AdminField>
        </div>
        <label className="flex items-center gap-3 text-sm">
          <Toggle
            checked={!!p.bestSeller}
            onChange={(v) =>
              setP(({ bestSeller: _b, ...x }) => (v ? { ...x, bestSeller: true } : x))
            }
            label="Best seller"
          />{" "}
          Show "Best seller" badge
        </label>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button type="submit" variant="gold" disabled={busy}>
            {isNew ? "Create product" : "Save changes"}
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          {!isNew && (
            <Button
              type="button"
              variant={confirmDel ? "destructive" : "ghost"}
              className={`ml-auto ${confirmDel ? "" : "text-destructive"}`}
              onClick={async () => {
                if (!confirmDel) return setConfirmDel(true);
                if (await write(deleteProduct({ data: p.id }), "Product deleted")) onDone();
              }}
            >
              <Trash2 /> {confirmDel ? "Click again to delete" : "Delete"}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
