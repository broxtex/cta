import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-transform duration-150 ease-out disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest",
  {
    variants: {
      variant: {
        default: "bg-forest text-paper hover:bg-forest-dark",
        brass: "bg-brass text-ink hover:brightness-95",
        outline: "border border-border bg-transparent text-ink hover:bg-paper-2",
        ghost: "bg-transparent text-muted hover:text-ink",
        danger: "bg-error text-cream",
      },
      size: {
        default: "h-11 rounded-md px-4 text-sm",
        sm: "h-9 rounded-md px-3 text-xs",
        lg: "h-12 rounded-lg px-5 text-sm",
        icon: "size-11 rounded-full",
        pill: "h-11 rounded-full px-5 text-sm",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
