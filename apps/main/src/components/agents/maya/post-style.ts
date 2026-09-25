/**
 * Theme-safe styling shared by Maya's published-posts calendar and gallery.
 *
 * Both used to hardcode light-only colours: pastel `bg-green-50`-style status
 * chips (pale slabs on a dark surface), a `#000000` X/Twitter marker that
 * vanishes on dark, and white text on `bg-primary` (primary is warm white in
 * dark mode, so the text disappeared). Everything here reads theme tokens, so
 * one definition is right in both themes.
 */

export interface PlatformStyle {
  label: string
  /** Chip background. Brand colour, except X which follows the theme's ink. */
  color: string
  /** Text colour that stays readable on `color` in both themes. */
  ink: string
  /** Tailwind class for the small calendar dot. */
  dot: string
}

export const PLATFORM_STYLE: Record<string, PlatformStyle> = {
  LINKEDIN: { label: "LinkedIn", color: "#0077B5", ink: "#ffffff", dot: "bg-[#0077B5]" },
  // Black is invisible on a dark surface and white is invisible on a light
  // one, so X takes the theme's foreground and its background for the text.
  TWITTER: {
    label: "X / Twitter",
    color: "var(--foreground)",
    ink: "var(--background)",
    dot: "bg-foreground",
  },
  INSTAGRAM: { label: "Instagram", color: "#E1306C", ink: "#ffffff", dot: "bg-[#E1306C]" },
}

export const UNKNOWN_PLATFORM_DOT = "bg-muted-foreground"

/** Status chip classes: tinted fill + foreground text, like `StatusPill`. */
export const STATUS_TONE: Record<string, string> = {
  success: "border-chart-2/50 bg-chart-2/15 text-foreground",
  failed: "border-destructive/50 bg-destructive/15 text-destructive",
  scheduled: "border-chart-1/50 bg-chart-1/15 text-foreground",
  cancelled: "border-border bg-muted text-muted-foreground",
}

/** Anything not listed above (pending, publishing…). */
export const STATUS_TONE_PENDING = "border-chart-3/50 bg-chart-3/15 text-foreground"
