import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { categoryLabel, priceLabel } from "@/lib/catalog/format";
import type { Product, StoreSettings } from "@/lib/catalog/types";
import { HangerIcon } from "./icons";
import { toast } from "sonner";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function downloadStory(product: Product, settings: StoreSettings, photoIndex: number) {
  const w = 1080;
  const h = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = "#2A2320";
  ctx.fillRect(0, 0, w, h);
  const src = product.images[photoIndex];
  if (src) {
    const img = await loadImage(src);
    const scale = Math.max(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }
  const g = ctx.createLinearGradient(0, h * 0.52, 0, h);
  g.addColorStop(0, "rgba(10,8,7,0)");
  g.addColorStop(0.4, "rgba(10,8,7,0.55)");
  g.addColorStop(1, "rgba(10,8,7,0.92)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#F6EFEA";
  ctx.font = "600 62px Fraunces, Georgia, serif";
  const title = product.soldOut ? `${product.name} (agotada)` : product.name;
  wrapText(ctx, title, 72, h - 340, w - 144, 72);
  const price = priceLabel(product, settings.currency);
  ctx.fillStyle = "#E4C591";
  ctx.font = "700 44px Karla, sans-serif";
  ctx.fillText(price.display, 72, h - 230);
  ctx.fillStyle = "#D9CFC8";
  ctx.font = "400 32px Karla, sans-serif";
  let y = h - 170;
  if (product.sizes) {
    ctx.fillText(`Tallas: ${product.sizes}`, 72, y);
    y += 44;
  }
  ctx.font = "italic 500 32px Fraunces, Georgia, serif";
  ctx.fillStyle = "#C9BDB5";
  ctx.fillText(settings.brand, 72, h - 80);

  const link = document.createElement("a");
  const safe = (product.name || "prenda")
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñ\s-]/gi, "")
    .trim()
    .replace(/\s+/g, "-");
  link.download = `${safe || "prenda"}-estado.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(" ");
  let line = "";
  let drawY = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, drawY);
      line = word;
      drawY += lineHeight;
    } else line = test;
  }
  ctx.fillText(line, x, drawY);
}

export function StatusViewer({
  products,
  index,
  settings,
  onClose,
  onIndex,
}: {
  products: Product[];
  index: number;
  settings: StoreSettings;
  onClose: () => void;
  onIndex: (next: number) => void;
}) {
  const product = products[index];
  const [photo, setPhoto] = useState(0);
  const [touchX, setTouchX] = useState<number | null>(null);

  useEffect(() => setPhoto(0), [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onIndex(Math.max(0, index - 1));
      if (e.key === "ArrowRight") onIndex(Math.min(products.length - 1, index + 1));
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        if (!product) return;
        const n = product.images.length;
        if (n > 1) setPhoto((p) => (p + 1) % n);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, onClose, onIndex, product, products.length]);

  if (!product) return null;
  const imgs = product.images;
  const src = imgs[photo];
  const price = priceLabel(product, settings.currency);

  return (
    <div className="fixed inset-0 z-50 bg-[#15110F]">
      <div
        className="relative mx-auto flex h-full max-w-md items-center justify-center"
        onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX == null) return;
          const dx = e.changedTouches[0].clientX - touchX;
          if (Math.abs(dx) > 40) {
            onIndex(Math.min(products.length - 1, Math.max(0, index + (dx < 0 ? 1 : -1))));
          }
          setTouchX(null);
        }}
      >
        <div className="relative mx-4 aspect-story w-full max-w-sm overflow-hidden rounded-lg bg-ink">
          {imgs.length > 1 ? (
            <div className="absolute top-4 left-1/2 z-2 flex -translate-x-1/2 gap-1.5">
              {imgs.map((_, i) => (
                <span
                  key={i}
                  className={`size-1.5 rounded-full ${i === photo ? "bg-cream" : "bg-cream/35"}`}
                />
              ))}
            </div>
          ) : null}
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => {
              if (imgs.length > 1) setPhoto((p) => (p + 1) % imgs.length);
            }}
            aria-label="Cambiar foto"
          >
            {src ? (
              <img src={src} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center bg-paper-2 text-border">
                <HangerIcon className="w-1/5" />
              </div>
            )}
          </button>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-ink via-ink/60 to-transparent px-5 pt-16 pb-6 text-cream">
            <p className="font-display text-xl font-semibold">
              {product.name}
              {product.soldOut ? " (agotada)" : ""}
            </p>
            <p className="mt-1 font-bold text-brass">{price.display}</p>
            {product.sizes ? (
              <p className="mt-1 text-xs text-cream/80">Tallas: {product.sizes}</p>
            ) : null}
            {product.description ? (
              <p className="mt-1 text-xs text-cream/80">{product.description}</p>
            ) : null}
            <p className="mt-2 font-display text-xs italic text-cream/70">
              {settings.brand}
              {product.category ? ` · ${categoryLabel(product.category)}` : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0">
        <p className="pointer-events-auto absolute top-5 left-5 rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-cream">
          {index + 1} / {products.length}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="pointer-events-auto absolute top-4 right-4 grid size-11 place-items-center rounded-full bg-white/12 text-cream"
          aria-label="Cerrar"
        >
          <X className="size-4" />
        </button>
        <button
          type="button"
          disabled={index === 0}
          onClick={() => onIndex(index - 1)}
          className="pointer-events-auto absolute top-1/2 left-2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/12 text-cream disabled:opacity-25"
          aria-label="Anterior"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          type="button"
          disabled={index === products.length - 1}
          onClick={() => onIndex(index + 1)}
          className="pointer-events-auto absolute top-1/2 right-2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/12 text-cream disabled:opacity-25"
          aria-label="Siguiente"
        >
          <ChevronRight className="size-5" />
        </button>
        <button
          type="button"
          className="pointer-events-auto absolute bottom-6 left-1/2 flex h-12 -translate-x-1/2 items-center gap-2 rounded-full bg-brass px-5 text-sm font-bold text-ink shadow-lg"
          onClick={() => {
            toast("Preparando imagen…");
            downloadStory(product, settings, photo)
              .then(() => toast("Imagen lista para tu estado"))
              .catch(() => toast("No se pudo generar la imagen"));
          }}
        >
          <Download className="size-4" />
          Descargar para tu estado
        </button>
      </div>
    </div>
  );
}
