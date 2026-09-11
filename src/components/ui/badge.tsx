import { cn } from "@/lib/utils";

export function Badge({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm bg-ink/80 px-2 py-1 text-xs font-bold text-cream",
        className,
      )}
    >
      {children}
    </span>
  );
}
