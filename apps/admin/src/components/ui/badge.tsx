import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "outline" | "success";

const variants: Record<BadgeVariant, string> = {
  default: "bg-[var(--primary)] text-[var(--primary-foreground)]",
  outline: "border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]",
  success: "bg-[var(--vq-green)] text-black",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
