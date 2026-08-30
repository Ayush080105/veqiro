"use client"

import * as React from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-xs font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
        // ── Veqiro brand variants ────────────────────────────────────────────
        // Soft CTAs: hairline border, layered elevation shadow, display font.
        // Press effect: nudges down 1px on click.
        brand:
          "rounded-lg border border-[var(--vq-line-2)] bg-destructive text-foreground font-display font-medium shadow-[var(--vq-shadow)] hover:bg-destructive/90 hover:shadow-[var(--vq-shadow-lg)] active:not-aria-[haspopup]:translate-y-px disabled:opacity-45",
        "brand-dark":
          "rounded-lg border border-[var(--vq-line-2)] bg-primary text-primary-foreground font-display font-medium shadow-[var(--vq-shadow)] hover:bg-primary/90 hover:shadow-[var(--vq-shadow-lg)] active:not-aria-[haspopup]:translate-y-px disabled:opacity-45",
        "brand-yellow":
          "rounded-lg border border-[var(--vq-line-2)] bg-accent text-foreground font-display font-medium shadow-[var(--vq-shadow)] hover:bg-accent/90 hover:shadow-[var(--vq-shadow-lg)] active:not-aria-[haspopup]:translate-y-px disabled:opacity-45",
        "brand-ghost":
          "rounded-lg border border-[var(--vq-line-2)] bg-transparent text-foreground font-display font-medium hover:bg-foreground/5 active:not-aria-[haspopup]:translate-y-px disabled:opacity-45",
        // ── Chat action button: dark pill CTA used inside agent result cards ──
        "chat-action":
          "h-auto rounded-full bg-[#111] px-3.5 py-1.5 text-[11px] font-medium text-[#FFF9ED] hover:opacity-80 gap-1.5 [&_svg:not([class*='size-'])]:size-3",
        // ── Chat utility button: warm cream pill for copy/export/secondary actions ──
        "chat-utility":
          "h-auto rounded-full bg-[#FFF9ED] border border-[#D4C9B0] text-[#111] px-3 py-1.5 text-[11px] font-medium hover:bg-[#EFE7D6] gap-1.5 [&_svg:not([class*='size-'])]:size-3",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 px-2 text-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 px-2.5 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        icon: "size-8",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7",
        "icon-lg": "size-9",
        // ── Brand sizes ──────────────────────────────────────────────────────
        brand: "h-12 gap-2 px-6 text-sm",
        "brand-sm": "h-10 gap-1.5 px-4 text-xs",
        "brand-lg": "h-14 gap-2 px-8 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size, className }))

  if (asChild && React.isValidElement(children)) {
    return (
      <ButtonPrimitive
        data-slot="button"
        className={classes}
        render={children as React.ReactElement<Record<string, unknown>>}
        nativeButton={false}
        {...props}
      />
    )
  }

  return (
    <ButtonPrimitive
      data-slot="button"
      className={classes}
      {...props}
    >
      {children}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
