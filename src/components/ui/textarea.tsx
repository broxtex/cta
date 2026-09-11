import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-16 w-full resize-y border-0 border-b border-border bg-transparent px-0.5 py-2 text-base text-ink placeholder:text-muted/80 focus:border-forest focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}
