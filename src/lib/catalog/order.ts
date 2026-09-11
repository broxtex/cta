import { digitsPhone, finalPrice, formatMoney } from "./format";
import type { CartLine, Product, StoreSettings } from "./types";

export function cartLineTotal(line: CartLine, product: Product | undefined): number {
  if (!product) return 0;
  return finalPrice(product) * (Number(line.qty) || 0);
}

export function buildOrderMessage(
  settings: StoreSettings,
  products: Product[],
  lines: CartLine[],
  customerName: string,
): string | null {
  if (lines.length === 0) return null;
  const name = customerName.trim();
  const rows = name
    ? [`Hola! Soy ${name}. Me interesan estas prendas de ${settings.brand}:`, ""]
    : [`Hola! Me interesan estas prendas de ${settings.brand}:`, ""];
  let total = 0;
  let i = 0;
  for (const line of lines) {
    const p = products.find((x) => x.id === line.id);
    if (!p) continue;
    i += 1;
    const sub = cartLineTotal(line, p);
    total += sub;
    const sizeBit = line.size ? ` — talla ${line.size}` : "";
    const priceBit =
      p.price > 0 ? ` — ${settings.currency} ${formatMoney(sub)}` : " — a consultar";
    rows.push(`${i}. ${p.name}${sizeBit} × ${line.qty}${priceBit}`);
  }
  if (i === 0) return null;
  rows.push("");
  rows.push(
    total > 0
      ? `Total aproximado: ${settings.currency} ${formatMoney(total)}`
      : "Quiero consultar precios y disponibilidad.",
  );
  return rows.join("\n");
}

export function whatsappUrl(phone: string, text: string): string | null {
  const digits = digitsPhone(phone);
  if (digits.length < 10) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function openWhatsApp(phone: string, text: string): boolean {
  const url = whatsappUrl(phone, text);
  if (!url) return false;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}
