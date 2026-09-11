import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartLine } from "./types";

type CartState = {
  lines: CartLine[];
  customerName: string;
  add: (id: string, size: string, qty: number) => void;
  setQty: (index: number, qty: number) => void;
  remove: (index: number) => void;
  clear: () => void;
  setCustomerName: (name: string) => void;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      customerName: "",
      add: (id, size, qty) => {
        const lines = [...get().lines];
        const idx = lines.findIndex((l) => l.id === id && (l.size || "") === (size || ""));
        if (idx >= 0) lines[idx] = { ...lines[idx], qty: lines[idx].qty + qty };
        else lines.push({ id, size, qty });
        set({ lines });
      },
      setQty: (index, qty) => {
        const lines = [...get().lines];
        if (!lines[index]) return;
        lines[index] = { ...lines[index], qty: Math.max(1, qty) };
        set({ lines });
      },
      remove: (index) => {
        set({ lines: get().lines.filter((_, i) => i !== index) });
      },
      clear: () => set({ lines: [] }),
      setCustomerName: (customerName) => set({ customerName }),
    }),
    { name: "smith-cart" },
  ),
);

export function cartQtyTotal(lines: CartLine[]): number {
  return lines.reduce((n, l) => n + (Number(l.qty) || 0), 0);
}
