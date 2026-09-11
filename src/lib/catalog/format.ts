import type { Product } from "./types";

export function finalPrice(p: Pick<Product, "price" | "discount">): number {
  const orig = Number(p.price) || 0;
  const disc = Number(p.discount) || 0;
  if (disc > 0 && disc < 100) return Math.round(orig * (1 - disc / 100) * 100) / 100;
  return orig;
}

export function formatMoney(n: number): string {
  const v = Number(n) || 0;
  if (Number.isInteger(v)) return v.toLocaleString("es-DO");
  return v.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function priceLabel(
  p: Pick<Product, "price" | "discount">,
  currency: string,
): { display: string; original?: string; consult: boolean } {
  const orig = Number(p.price) || 0;
  if (orig <= 0) return { display: "A consultar", consult: true };
  const fin = finalPrice(p);
  if (Number(p.discount) > 0 && fin < orig) {
    return {
      display: `${currency} ${formatMoney(fin)}`,
      original: `${currency} ${formatMoney(orig)}`,
      consult: false,
    };
  }
  return { display: `${currency} ${formatMoney(fin)}`, consult: false };
}

export function parseSizes(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,/|;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function uid(): string {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function digitsPhone(raw: string): string {
  return (raw || "").replace(/[^0-9]/g, "");
}

export function categoryLabel(name: string): string {
  const n = (name || "").trim();
  if (!n) return "Otros";
  const map: Record<string, string> = {
    conjutos: "Conjuntos",
    sueters: "Suéteres",
    suéteres: "Suéteres",
  };
  return map[n.toLowerCase()] || n;
}
