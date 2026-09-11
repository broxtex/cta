import { useEffect, useMemo, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import {
  MessageCircle,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  bulkAddProducts,
  deleteProduct,
  saveProduct,
  saveSettings,
  suggestFromPhoto,
} from "@/lib/catalog/server";
import { getMyAccess, type StaffRole } from "@/lib/catalog/staff";
import { cartQtyTotal, useCart } from "@/lib/catalog/cart-store";
import {
  categoryLabel,
  digitsPhone,
  finalPrice,
  formatMoney,
  parseSizes,
  priceLabel,
} from "@/lib/catalog/format";
import { resizeImageFiles } from "@/lib/catalog/images";
import { buildOrderMessage, cartLineTotal, openWhatsApp } from "@/lib/catalog/order";
import type { CatalogPayload, Product, ProductInput, StoreSettings } from "@/lib/catalog/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { HangerIcon } from "./icons";
import { ProductCard } from "./product-card";
import { StatusViewer } from "./status-viewer";
import { AccountsModal } from "./accounts-modal";
import { cn } from "@/lib/utils";

const SUGGESTED_CATS = [
  "Conjuntos",
  "Bermudas",
  "Gorras",
  "Tenis",
  "Crocs",
  "Suéteres",
  "Correas",
  "Polos",
  "Camisas",
  "Accesorios",
];

export function CatalogPage({ catalog }: { catalog: CatalogPayload }) {
  const router = useRouter();
  const { user, isPending: authPending } = useCurrentUserState();
  const [role, setRole] = useState<StaffRole | null>(null);
  const [accessReady, setAccessReady] = useState(false);
  const canEdit = Boolean(user) && (role === "owner" || role === "staff");
  const lines = useCart((s) => s.lines);
  const customerName = useCart((s) => s.customerName);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [statusId, setStatusId] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [addProduct, setAddProduct] = useState<Product | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null | "new">(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);

  useEffect(() => setReady(true), []);

  useEffect(() => {
    if (authPending) return;
    if (!user) {
      setRole(null);
      setAccessReady(true);
      return;
    }
    setAccessReady(false);
    void getMyAccess()
      .then((a) => {
        setRole(a.role);
      })
      .catch(() => setRole(null))
      .finally(() => setAccessReady(true));
  }, [user?.id, authPending]);

  const settings: StoreSettings = catalog.settings;
  const products = catalog.products;
  const qty = ready ? cartQtyTotal(lines) : 0;

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      const c = (p.category || "").trim();
      if (c) set.add(c);
    }
    return [...set].sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b), "es"));
  }, [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (filter === "sale" && !(Number(p.discount) > 0)) return false;
      if (filter !== "all" && filter !== "sale" && (p.category || "").trim() !== filter) return false;
      if (!q) return true;
      const hay = `${p.name} ${p.category} ${p.description} ${p.sizes}`.toLowerCase();
      return hay.includes(q);
    });
  }, [products, query, filter]);

  const sections = useMemo(() => {
    const featured =
      filter === "all" && !query.trim() ? filtered.filter((p) => p.featured) : [];
    const groups = new Map<string, Product[]>();
    for (const p of filtered) {
      if (featured.includes(p) && filter === "all" && !query.trim()) continue;
      const key = (p.category || "").trim();
      const list = groups.get(key) ?? [];
      list.push(p);
      groups.set(key, list);
    }
    const keys = [...groups.keys()].sort((a, b) => {
      if (!a) return 1;
      if (!b) return -1;
      return categoryLabel(a).localeCompare(categoryLabel(b), "es");
    });
    const out: { title: string; items: Product[] }[] = [];
    if (featured.length) out.push({ title: "Destacadas", items: featured });
    for (const k of keys) out.push({ title: categoryLabel(k), items: groups.get(k) ?? [] });
    return out;
  }, [filtered, filter, query]);

  const statusOrder = useMemo(() => {
    const groups = new Map<string, Product[]>();
    for (const p of products) {
      const key = categoryLabel(p.category);
      const list = groups.get(key) ?? [];
      list.push(p);
      groups.set(key, list);
    }
    const keys = [...groups.keys()].sort((a, b) => a.localeCompare(b, "es"));
    return keys.flatMap((k) => groups.get(k) ?? []);
  }, [products]);

  const statusIndex = statusId ? statusOrder.findIndex((p) => p.id === statusId) : -1;

  function refresh() {
    void router.invalidate();
  }

  function sendOrder() {
    const msg = buildOrderMessage(settings, products, lines, customerName);
    if (!msg) {
      toast("Agrega prendas al pedido primero");
      return;
    }
    const ok = openWhatsApp(settings.whatsapp, msg);
    if (!ok) {
      toast("Falta un WhatsApp válido en los datos de la tienda");
      if (canEdit) setSettingsOpen(true);
      return;
    }
    toast("Abriendo WhatsApp…");
  }

  function chatStore() {
    const ok = openWhatsApp(
      settings.whatsapp,
      `Hola! Vi el catálogo de ${settings.brand} y quiero consultar.`,
    );
    if (!ok) {
      toast("Esta tienda aún no tiene WhatsApp configurado");
      if (canEdit) setSettingsOpen(true);
    }
  }

  function onWhatsAppHeader() {
    if (qty > 0) sendOrder();
    else chatStore();
  }

  function onSelectProduct(p: Product) {
    if (p.soldOut) {
      toast("Esta prenda está agotada");
      return;
    }
    setAddProduct(p);
  }

  async function onDelete(p: Product) {
    if (!window.confirm(`¿Eliminar “${p.name}” del catálogo?`)) return;
    try {
      await deleteProduct({ data: { id: p.id } });
      refresh();
      toast("Prenda eliminada");
    } catch {
      toast("No se pudo eliminar. Inicia sesión.");
    }
  }

  useEffect(() => {
    if (settings.brand) document.title = settings.brand;
  }, [settings.brand]);

  return (
    <div className="min-h-dvh bg-paper pb-16 text-ink">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-paper/95 pt-[env(safe-area-inset-top)] backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-xl font-semibold leading-tight">
              {settings.brand}
            </h1>
            {settings.tagline ? (
              <p className="truncate font-display text-xs italic text-muted">{settings.tagline}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onWhatsAppHeader}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-brass text-ink"
            aria-label={qty > 0 ? "Enviar pedido por WhatsApp" : "Escribir por WhatsApp"}
          >
            <MessageCircle className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="relative grid size-11 shrink-0 place-items-center rounded-full bg-forest text-paper"
            aria-label="Ver pedido"
          >
            <ShoppingBag className="size-5" />
            {qty > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 grid min-w-5 place-items-center rounded-full bg-brass px-1 text-xs font-bold text-ink tabular-nums">
                {qty}
              </span>
            ) : null}
          </button>
        </div>
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-4 gap-y-1 px-3 pb-2 text-xs">
          {authPending || (user && !accessReady) ? (
            <span className="h-4 w-24 animate-pulse rounded bg-border" />
          ) : canEdit ? (
            <>
              <button type="button" className="text-muted underline-offset-3 hover:text-ink hover:underline" onClick={() => setEditProduct("new")}>
                Agregar prenda
              </button>
              <button type="button" className="text-muted underline-offset-3 hover:text-ink hover:underline" onClick={() => setSettingsOpen(true)}>
                Editar tienda
              </button>
              <button type="button" className="text-muted underline-offset-3 hover:text-ink hover:underline" onClick={() => setAccountsOpen(true)}>
                Cuentas
              </button>
              {user?.displayName ? (
                <span className="max-w-[7rem] truncate text-muted">{user.displayName}</span>
              ) : null}
              <button
                type="button"
                className="text-muted underline-offset-3 hover:text-ink hover:underline"
                onClick={() => {
                  void signOut().catch(() => toast("No se pudo salir. Inténtalo de nuevo."));
                }}
              >
                Salir
              </button>
            </>
          ) : (
            <Link to="/login" className="text-muted underline-offset-3 hover:text-ink hover:underline">
              Iniciar sesión
            </Link>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 pt-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar prenda, categoría o talla…"
            className="h-11 w-full rounded-full border border-border bg-cream py-2 pr-4 pl-10 text-sm text-ink placeholder:text-muted focus:border-forest focus:outline-none"
          />
        </label>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[
            { id: "all", label: "Todo" },
            { id: "sale", label: "Ofertas" },
            ...categories.map((c) => ({ id: c, label: categoryLabel(c) })),
          ].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setFilter(c.id)}
              className={cn(
                "h-9 shrink-0 rounded-full border px-3.5 text-xs font-semibold",
                filter === c.id
                  ? "border-forest bg-forest text-paper"
                  : "border-border text-muted",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 pb-8">
        {products.length === 0 ? (
          <EmptyState canEdit={canEdit} onAdd={() => setEditProduct("new")} />
        ) : filtered.length === 0 ? (
          <div className="px-4 py-16 text-center text-muted">
            <HangerIcon className="mx-auto mb-3 size-11 text-border" />
            <p>No hay prendas con ese filtro. Prueba otra búsqueda o categoría.</p>
          </div>
        ) : (
          sections.map((sec) => (
            <section key={sec.title} className="mt-8">
              <h2 className="font-display text-xl font-semibold">{sec.title}</h2>
              <p className="mb-3 text-xs text-muted">
                {sec.items.length} {sec.items.length === 1 ? "prenda" : "prendas"}
              </p>
              <hr className="mb-4 border-border" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {sec.items.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    currency={settings.currency}
                    selected={lines.some((l) => l.id === p.id)}
                    canEdit={canEdit}
                    onOpen={() => setStatusId(p.id)}
                    onSelect={() => onSelectProduct(p)}
                    onEdit={() => setEditProduct(p)}
                    onDelete={() => void onDelete(p)}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      <button
        type="button"
        onClick={() => setAssistantOpen(true)}
        className="fixed bottom-6 left-5 z-30 grid size-12 place-items-center rounded-full bg-brass text-ink shadow-lg"
        aria-label="Abrir asistente"
      >
        <MessageCircle className="size-5" />
      </button>
      {canEdit ? (
        <button
          type="button"
          onClick={() => setEditProduct("new")}
          className="fixed right-5 bottom-6 z-30 grid size-14 place-items-center rounded-full bg-forest text-paper shadow-lg"
          aria-label="Agregar prenda"
        >
          <Plus className="size-6" />
        </button>
      ) : null}

      {statusIndex >= 0 ? (
        <StatusViewer
          products={statusOrder}
          index={statusIndex}
          settings={settings}
          onClose={() => setStatusId(null)}
          onIndex={(i) => setStatusId(statusOrder[i]?.id ?? null)}
        />
      ) : null}

      <CartModal
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        products={products}
        settings={settings}
        onSend={sendOrder}
      />
      <AddCartModal product={addProduct} onClose={() => setAddProduct(null)} />
      <ProductModal
        open={editProduct !== null}
        product={editProduct === "new" ? null : editProduct}
        categories={SUGGESTED_CATS}
        onClose={() => setEditProduct(null)}
        onSaved={() => {
          setEditProduct(null);
          refresh();
        }}
        onBulk={() => {
          setEditProduct(null);
          setBulkOpen(true);
        }}
      />
      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSaved={() => {
          setSettingsOpen(false);
          refresh();
        }}
      />
      <AccountsModal
        open={accountsOpen}
        onClose={() => setAccountsOpen(false)}
        myId={user?.id ?? null}
        myRole={role}
      />
      <BulkModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onSaved={() => {
          setBulkOpen(false);
          refresh();
        }}
      />
      <AssistantModal
        open={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        products={products}
        settings={settings}
        onGoto={(id) => {
          setAssistantOpen(false);
          setStatusId(id);
        }}
      />
    </div>
  );
}

function EmptyState({ canEdit, onAdd }: { canEdit: boolean; onAdd: () => void }) {
  return (
    <div className="px-6 py-20 text-center text-muted">
      <HangerIcon className="mx-auto mb-3 size-11 text-border" />
      <p className="mx-auto max-w-xs text-sm leading-relaxed">
        {canEdit
          ? "Tu catálogo está vacío. Agrega tu primera prenda para empezar."
          : "Este catálogo está vacío por ahora. Vuelve pronto."}
      </p>
      {canEdit ? (
        <Button className="mt-4" onClick={onAdd}>
          Agregar prenda
        </Button>
      ) : null}
    </div>
  );
}

function CartModal({
  open,
  onClose,
  products,
  settings,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  products: Product[];
  settings: StoreSettings;
  onSend: () => void;
}) {
  const lines = useCart((s) => s.lines);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const clear = useCart((s) => s.clear);
  const customerName = useCart((s) => s.customerName);
  const setCustomerName = useCart((s) => s.setCustomerName);
  const total = lines.reduce((n, l) => {
    const p = products.find((x) => x.id === l.id);
    return n + cartLineTotal(l, p);
  }, 0);

  return (
    <Modal open={open} onClose={onClose} title="Tu pedido">
      {lines.length === 0 ? (
        <p className="text-sm text-muted">Todavía no hay prendas en el pedido.</p>
      ) : (
        <div className="mb-3 flex max-h-[42vh] flex-col gap-2.5 overflow-y-auto">
          {lines.map((line, i) => {
            const p = products.find((x) => x.id === line.id);
            if (!p) return null;
            const sub = cartLineTotal(line, p);
            return (
              <div key={`${line.id}-${line.size}-${i}`} className="flex justify-between gap-3 rounded-lg border border-border bg-cream p-3">
                <div>
                  <p className="text-sm font-semibold">{p.name}</p>
                  <p className="text-xs text-muted">
                    {line.size ? `Talla ${line.size} · ` : ""}
                    {p.price > 0
                      ? `${settings.currency} ${formatMoney(finalPrice(p))} c/u`
                      : "A consultar"}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <button type="button" className="grid size-8 place-items-center rounded-full border border-border" onClick={() => setQty(i, line.qty - 1)} aria-label="Menos">
                      <Minus className="size-3.5" />
                    </button>
                    <span className="min-w-6 text-center text-sm font-bold tabular-nums">{line.qty}</span>
                    <button type="button" className="grid size-8 place-items-center rounded-full border border-border" onClick={() => setQty(i, line.qty + 1)} aria-label="Más">
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                  <button type="button" className="mt-2 text-xs text-error underline" onClick={() => remove(i)}>
                    Quitar
                  </button>
                </div>
                <strong className="text-sm">
                  {p.price > 0 ? `${settings.currency} ${formatMoney(sub)}` : "—"}
                </strong>
              </div>
            );
          })}
        </div>
      )}
      {lines.length > 0 && total > 0 ? (
        <p className="mb-3 text-base font-bold">
          Total: {settings.currency} {formatMoney(total)}
        </p>
      ) : null}
      <div className="mb-4">
        <Label htmlFor="customerName">Tu nombre (opcional)</Label>
        <Input
          id="customerName"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          maxLength={40}
          placeholder="Para que sepan quién pide"
        />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => { clear(); onClose(); }}>
          Vaciar
        </Button>
        <Button variant="brass" className="flex-1" onClick={onSend} disabled={lines.length === 0}>
          Enviar por WhatsApp
        </Button>
      </div>
    </Modal>
  );
}

function AddCartModal({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const add = useCart((s) => s.add);
  const [qty, setQty] = useState(1);
  const [size, setSize] = useState("");
  const sizes = parseSizes(product?.sizes || "");

  useEffect(() => {
    setQty(1);
    setSize(sizes[0] || "");
  }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function confirm() {
    if (!product) return;
    if (sizes.length && !size) {
      toast("Elige una talla");
      return;
    }
    add(product.id, size, qty);
    toast("Agregada al pedido");
    onClose();
  }

  return (
    <Modal open={Boolean(product)} onClose={onClose} title={product?.name || "Agregar al pedido"}>
      {sizes.length ? (
        <div className="mb-4">
          <Label>Talla</Label>
          <div className="mt-1 flex flex-wrap gap-2">
            {sizes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                className={cn(
                  "h-10 rounded-full border px-3.5 text-sm font-semibold",
                  s === size ? "border-forest bg-forest text-paper" : "border-border text-ink",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="mb-5">
        <Label>Cantidad</Label>
        <div className="mt-1 flex items-center gap-3">
          <button type="button" className="grid size-11 place-items-center rounded-full border border-border" onClick={() => setQty((n) => Math.max(1, n - 1))}>
            <Minus className="size-4" />
          </button>
          <span className="min-w-6 text-center text-lg font-bold tabular-nums">{qty}</span>
          <button type="button" className="grid size-11 place-items-center rounded-full border border-border" onClick={() => setQty((n) => n + 1)}>
            <Plus className="size-4" />
          </button>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Cancelar
        </Button>
        <Button className="flex-1" onClick={confirm}>
          Agregar
        </Button>
      </div>
    </Modal>
  );
}

function ProductModal({
  open,
  product,
  categories,
  onClose,
  onSaved,
  onBulk,
}: {
  open: boolean;
  product: Product | null;
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
  onBulk: () => void;
}) {
  const [form, setForm] = useState<ProductInput>({
    name: "",
    category: "",
    price: 0,
    sizes: "",
    description: "",
    discount: 0,
    featured: false,
    soldOut: false,
    images: [],
  });
  const [aiStatus, setAiStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [nameErr, setNameErr] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (product) {
      setForm({
        id: product.id,
        name: product.name,
        category: product.category,
        price: product.price,
        sizes: product.sizes,
        description: product.description,
        discount: product.discount,
        featured: product.featured,
        soldOut: product.soldOut,
        images: product.images.slice(),
      });
    } else {
      setForm({
        name: "",
        category: "",
        price: 0,
        sizes: "",
        description: "",
        discount: 0,
        featured: false,
        soldOut: false,
        images: [],
      });
    }
    setAiStatus("");
    setNameErr(false);
  }, [open, product]);

  function set<K extends keyof ProductInput>(key: K, value: ProductInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const imgs = await resizeImageFiles(files);
    setForm((f) => ({ ...f, images: [...f.images, ...imgs].slice(0, 8) }));
  }

  async function suggest() {
    if (!form.images[0]) return;
    setAiStatus("Analizando la foto…");
    try {
      const res = await suggestFromPhoto({ data: { image: form.images[0] } });
      if (!res.ok) {
        setAiStatus(res.error);
        return;
      }
      setForm((f) => ({
        ...f,
        name: res.nombre || f.name,
        category: res.categoria || f.category,
        description: res.descripcion || f.description,
      }));
      setAiStatus("Sugerido con IA. Revisa y ajusta si hace falta.");
    } catch {
      setAiStatus("La sugerencia con IA no está disponible ahora. Escríbela a mano.");
    }
  }

  async function onSubmit() {
    if (!form.name.trim()) {
      setNameErr(true);
      return;
    }
    setBusy(true);
    try {
      await saveProduct({
        data: {
          ...form,
          name: form.name.trim(),
          category: form.category.trim(),
          price: Number(form.price) || 0,
          discount: Math.min(90, Math.max(0, Number(form.discount) || 0)),
        },
      });
      toast(product ? "Prenda actualizada" : "Prenda agregada al catálogo");
      onSaved();
    } catch {
      toast("No se pudo guardar. Inicia sesión para editar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={product ? "Editar prenda" : "Agregar prenda"}>
      {!product ? (
        <button type="button" className="mb-4 text-xs text-muted underline-offset-3 hover:underline" onClick={onBulk}>
          Subir varias fotos a la vez
        </button>
      ) : null}
      <div className="space-y-4">
        <div>
          <Label htmlFor="pname">Nombre de la prenda</Label>
          <Input id="pname" value={form.name} maxLength={60} placeholder="Ej: Polo Stussy blanco" onChange={(e) => { set("name", e.target.value); setNameErr(false); }} />
          {nameErr ? <p className="mt-1 text-xs text-error">Escribe un nombre para la prenda.</p> : null}
        </div>
        <div>
          <Label htmlFor="pcat">Categoría</Label>
          <Input id="pcat" value={form.category} maxLength={30} list="cats" placeholder="Ej: Polos" onChange={(e) => set("category", e.target.value)} />
          <datalist id="cats">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <Label htmlFor="pprice">Precio (0 = a consultar)</Label>
          <Input id="pprice" type="number" min={0} step="0.01" value={Number.isFinite(form.price) ? form.price : 0} onChange={(e) => set("price", Number(e.target.value))} />
        </div>
        <div>
          <Label htmlFor="pdisc">Descuento % (opcional)</Label>
          <Input id="pdisc" type="number" min={0} max={90} value={form.discount || ""} placeholder="0" onChange={(e) => set("discount", Number(e.target.value) || 0)} />
        </div>
        <div>
          <Label htmlFor="psizes">Tallas disponibles</Label>
          <Input id="psizes" value={form.sizes} maxLength={40} placeholder="S, M, L o 36, 38, 40" onChange={(e) => set("sizes", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="pdesc">Descripción (opcional)</Label>
          <Textarea id="pdesc" maxLength={140} value={form.description} placeholder="Detalles, tela, color…" onChange={(e) => set("description", e.target.value)} />
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-forest" checked={form.featured} onChange={(e) => set("featured", e.target.checked)} />
          Destacar esta prenda
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-forest" checked={form.soldOut} onChange={(e) => set("soldOut", e.target.checked)} />
          Marcar como agotada
        </label>
        <div>
          <Label>Fotos</Label>
          <div className="mt-1 flex items-center gap-3">
            <div className="grid h-16 w-12 place-items-center overflow-hidden rounded-sm bg-paper-2">
              {form.images[0] ? (
                <img src={form.images[0]} alt="" className="h-full w-full object-cover" />
              ) : (
                <HangerIcon className="w-2/5 text-border" />
              )}
            </div>
            <label className="rounded-sm border border-dashed border-border px-3.5 py-2.5 text-xs text-muted">
              Agregar fotos
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void onFiles(e.target.files); e.target.value = ""; }} />
            </label>
          </div>
          {form.images.length ? (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {form.images.map((src, i) => (
                <div key={i} className="relative h-16 w-12 overflow-hidden rounded-sm bg-paper-2">
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    className="absolute top-0.5 right-0.5 grid size-5 place-items-center rounded-full bg-ink/70 text-xs text-cream"
                    onClick={() => set("images", form.images.filter((_, j) => j !== i))}
                    aria-label="Quitar foto"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <button
            type="button"
            disabled={!form.images.length}
            onClick={() => void suggest()}
            className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full border border-brass px-3.5 text-xs font-bold text-brass disabled:opacity-45"
          >
            <Sparkles className="size-3.5" />
            Sugerir con IA
          </button>
          {aiStatus ? <p className="mt-2 text-xs text-muted">{aiStatus}</p> : null}
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button className="flex-1" disabled={busy} onClick={() => void onSubmit()}>
            {busy ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function SettingsModal({
  open,
  settings,
  onClose,
  onSaved,
}: {
  open: boolean;
  settings: StoreSettings;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [brand, setBrand] = useState(settings.brand);
  const [tagline, setTagline] = useState(settings.tagline);
  const [currency, setCurrency] = useState(settings.currency);
  const [whatsapp, setWhatsapp] = useState(settings.whatsapp);

  useEffect(() => {
    if (!open) return;
    setBrand(settings.brand);
    setTagline(settings.tagline);
    setCurrency(settings.currency);
    setWhatsapp(settings.whatsapp);
  }, [open, settings]);

  async function onSubmit() {
    const digits = digitsPhone(whatsapp);
    if (whatsapp.trim() && digits.length < 10) {
      toast("El WhatsApp debe ir con código de país, por ejemplo 18291234567");
      return;
    }
    try {
      await saveSettings({
        data: {
          brand: brand.trim() || "Mi Catálogo",
          tagline: tagline.trim(),
          currency: currency.trim() || "RD$",
          whatsapp: whatsapp.trim(),
        },
      });
      toast("Datos actualizados");
      onSaved();
    } catch {
      toast("No se pudo guardar. Inicia sesión.");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Datos de tu catálogo">
      <div className="space-y-4">
        <div>
          <Label htmlFor="brand">Nombre de la tienda</Label>
          <Input id="brand" value={brand} maxLength={40} onChange={(e) => setBrand(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="tag">Eslogan (opcional)</Label>
          <Input id="tag" value={tagline} maxLength={60} onChange={(e) => setTagline(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="cur">Símbolo de moneda</Label>
          <Input id="cur" value={currency} maxLength={6} onChange={(e) => setCurrency(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="wa">WhatsApp para recibir pedidos</Label>
          <Input id="wa" value={whatsapp} maxLength={20} placeholder="18291234567" onChange={(e) => setWhatsapp(e.target.value)} />
          <p className="mt-1 text-xs text-muted">Código de país + número, sin espacios.</p>
        </div>
        <p className="text-xs leading-relaxed text-muted">
          Los cambios se guardan en la web al instante. Tus clientes ven lo nuevo al abrir el
          catálogo, sin descargar ni subir ningún archivo.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={() => void onSubmit()}>
            Guardar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function BulkModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [progress, setProgress] = useState("");
  const [busy, setBusy] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const list = Array.from(files);
    setProgress(`Procesando 0 de ${list.length}…`);
    const items: { name: string; images: string[] }[] = [];
    for (let i = 0; i < list.length; i++) {
      try {
        const [dataUrl] = await resizeImageFiles([list[i]]);
        if (dataUrl) items.push({ name: `Prenda nueva ${i + 1}`, images: [dataUrl] });
      } catch {
        /* skip */
      }
      setProgress(`Procesando ${i + 1} de ${list.length}…`);
    }
    try {
      if (items.length) await bulkAddProducts({ data: { items } });
      setProgress(`Se agregaron ${items.length} prenda(s). Tócalas para ponerles nombre, categoría y precio.`);
      toast("Prendas agregadas. Edítalas para completarlas");
      onSaved();
    } catch {
      toast("No se pudieron guardar. Inicia sesión.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Subir varias fotos">
      <p className="mb-4 text-sm leading-relaxed text-muted">
        Elige varias fotos a la vez. Cada una se agrega al catálogo con un nombre provisional
        para que después completes precio y categoría.
      </p>
      <label className="block rounded-sm border border-dashed border-border px-4 py-3 text-center text-sm text-muted">
        {busy ? "Procesando…" : "Elegir fotos"}
        <input type="file" accept="image/*" multiple className="hidden" disabled={busy} onChange={(e) => { void onFiles(e.target.files); e.target.value = ""; }} />
      </label>
      {progress ? <p className="mt-4 text-center text-sm">{progress}</p> : null}
      <Button variant="outline" className="mt-5 w-full" onClick={onClose}>
        Cerrar
      </Button>
    </Modal>
  );
}

function AssistantModal({
  open,
  onClose,
  products,
  settings,
  onGoto,
}: {
  open: boolean;
  onClose: () => void;
  products: Product[];
  settings: StoreSettings;
  onGoto: (id: string) => void;
}) {
  const [log, setLog] = useState<{ role: "bot" | "user"; text: string; ids?: string[] }[]>([]);
  const [input, setInput] = useState("");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (open && !started) {
      setStarted(true);
      setLog([
        {
          role: "bot",
          text: `Hola! Soy el asistente de ${settings.brand}. Puedo ayudarte a encontrar una prenda o explicarte cómo hacer tu pedido.`,
        },
      ]);
    }
  }, [open, started, settings.brand]);

  function push(role: "bot" | "user", text: string, ids?: string[]) {
    setLog((l) => [...l, { role, text, ids }]);
  }

  function handle(raw: string) {
    const text = raw.trim();
    if (!text) return;
    push("user", text);
    const q = text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (/como.*(pedid|compr|pido)|hacer.*pedido/.test(q)) {
      push("bot", "Toca el círculo con el + sobre la foto. Elige talla y cantidad. Arriba a la derecha está el pedido y el botón de WhatsApp para enviarlo.");
      return;
    }
    if (/novedad|nuevo|reciente/.test(q)) {
      const newest = [...products].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 6);
      push("bot", newest.length ? "Esto acaba de entrar:" : "Aún no hay prendas.", newest.map((p) => p.id));
      return;
    }
    if (/barat|oferta|descuento/.test(q) && !/menos de|bajo|precio|cuesta|cuanto/.test(q)) {
      const cheap = [...products].filter((p) => p.price > 0).sort((a, b) => finalPrice(a) - finalPrice(b)).slice(0, 6);
      push("bot", cheap.length ? "Estas son las más accesibles:" : "No hay precios cargados todavía.", cheap.map((p) => p.id));
      return;
    }
    if (/categor/.test(q)) {
      const names = [...new Set(products.map((p) => categoryLabel(p.category)))];
      push("bot", names.length ? `Categorías: ${names.join(", ")}.` : "Todavía no hay categorías.");
      return;
    }
    if (/precio|cuesta|cuanto|barato|menos de|bajo/.test(q)) {
      const m = q.match(/(\d+)/);
      if (m) {
        const limit = Number(m[1]);
        const hits = products.filter((p) => p.price > 0 && finalPrice(p) <= limit);
        push("bot", hits.length ? `Encontré esto por ${settings.currency} ${limit} o menos:` : "Nada en ese rango.", hits.slice(0, 6).map((p) => p.id));
      } else push("bot", 'Dime un precio máximo, por ejemplo: "menos de 1000".');
      return;
    }
    const hits = products.filter((p) => {
      const hay = `${p.name} ${p.category} ${p.description}`.toLowerCase();
      return hay.includes(text.toLowerCase());
    });
    push("bot", hits.length ? "Encontré esto:" : "No encontré nada con eso. Prueba con el nombre o una categoría.", hits.slice(0, 6).map((p) => p.id));
  }

  return (
    <Modal open={open} onClose={onClose} title="Asistente del catálogo">
      <div className="mb-3 flex max-h-[44vh] flex-col gap-2.5 overflow-y-auto">
        {log.map((m, i) => (
          <div key={i} className={cn("max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed", m.role === "user" ? "self-end rounded-br-sm bg-forest text-paper" : "self-start rounded-bl-sm bg-paper-2")}>
            {m.text}
            {m.ids?.length ? (
              <div className="mt-2 flex flex-col gap-1.5">
                {m.ids.map((id) => {
                  const p = products.find((x) => x.id === id);
                  if (!p) return null;
                  return (
                    <button
                      key={id}
                      type="button"
                      className="rounded-lg border border-border bg-cream px-2.5 py-2 text-left text-xs text-ink"
                      onClick={() => onGoto(id)}
                    >
                      {p.name} — {priceLabel(p, settings.currency).display}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {["Ver categorías", "Cómo hago un pedido", "Novedades", "Más baratas"].map((c) => (
          <button key={c} type="button" className="h-9 rounded-full border border-brass px-3 text-xs font-semibold text-brass" onClick={() => handle(c)}>
            {c}
          </button>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          handle(input);
          setInput("");
        }}
      >
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Escribe qué buscas…" className="rounded-full border border-border px-4" />
        <Button type="submit" size="pill">
          Enviar
        </Button>
      </form>
    </Modal>
  );
}
