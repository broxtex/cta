import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "max-h-[88vh] w-full overflow-y-auto rounded-t-2xl bg-paper px-5 pb-7 pt-5 shadow-card sm:rounded-2xl",
          wide ? "max-w-xl" : "max-w-lg",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {title ? (
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="grid size-11 place-items-center rounded-full text-muted hover:text-ink"
              aria-label="Cerrar"
            >
              <X className="size-5" />
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
