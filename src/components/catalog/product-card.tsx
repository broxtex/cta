import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { priceLabel } from "@/lib/catalog/format";
import type { Product } from "@/lib/catalog/types";
import { HangerIcon } from "./icons";
import { cn } from "@/lib/utils";

export function ProductCard({
  product,
  currency,
  selected,
  canEdit,
  onOpen,
  onSelect,
  onEdit,
  onDelete,
}: {
  product: Product;
  currency: string;
  selected: boolean;
  canEdit: boolean;
  onOpen: () => void;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const photo = product.images[0];
  const price = priceLabel(product, currency);

  return (
    <article className="relative overflow-visible rounded-sm border border-border bg-cream">
      <div className="relative aspect-portrait overflow-hidden rounded-t-sm bg-paper-2">
        <button
          type="button"
          className="absolute inset-0 z-10"
          onClick={onOpen}
          aria-label={`Ver ${product.name}`}
        />
        {photo ? (
          <img
            src={photo}
            alt={product.name}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="grid h-full place-items-center text-border">
            <HangerIcon className="w-2/5" />
          </div>
        )}
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          aria-label={selected ? `Ajustar pedido de ${product.name}` : `Agregar ${product.name} al pedido`}
          className={cn(
            "absolute top-2 left-2 z-10 grid size-11 place-items-center rounded-full border shadow-sm",
            selected
              ? "border-forest bg-forest text-paper"
              : "border-border bg-cream/90 text-forest",
          )}
        >
          {selected ? <Check className="size-4" /> : <Plus className="size-4" />}
        </button>
        {product.soldOut ? (
          <span className="absolute bottom-2 left-2 z-10 rounded-sm bg-ink/80 px-2 py-1 text-xs font-bold text-cream">
            Agotada
          </span>
        ) : null}
        {product.featured ? (
          <span className="absolute top-2 right-2 z-10 size-2 rounded-full bg-brass ring-4 ring-brass/35" />
        ) : null}
      </div>
      <div className="absolute top-2 -right-1.5 z-10 rotate-3 rounded-sm bg-brass px-2.5 py-1 text-xs font-bold whitespace-nowrap text-cream shadow-sm">
        {price.original ? (
          <>
            <s className="mr-1 font-medium opacity-75">{price.original}</s>
            {price.display}
          </>
        ) : (
          price.display
        )}
      </div>
      <div className="px-2.5 pt-2.5 pb-3">
        <p
          className={cn(
            "text-sm font-semibold leading-snug",
            product.soldOut ? "text-muted line-through" : "text-ink",
          )}
        >
          {product.name}
        </p>
        {product.sizes ? (
          <p className="mt-0.5 text-xs text-muted">Tallas: {product.sizes}</p>
        ) : null}
        {canEdit ? (
          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex min-h-11 items-center gap-1 text-xs text-muted hover:text-ink"
            >
              <Pencil className="size-3.5" /> Editar
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex min-h-11 items-center gap-1 text-xs text-muted hover:text-error"
            >
              <Trash2 className="size-3.5" /> Eliminar
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
