import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full border-0 border-b border-border bg-transparent px-0.5 py-2 text-base text-ink placeholder:text-muted/80 focus:border-forest focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}
