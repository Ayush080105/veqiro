// Font-family CSS variables — wired in app/layout.tsx via next/font.
// Use these for inline `style={{ fontFamily: FONT.x }}` cases where a Tailwind
// className isn't ergonomic (e.g. computed/dynamic styling). For static usage,
// prefer the Tailwind classes: font-display, font-head, font-body, font-mono.
export const FONT = {
  display: "var(--font-bagel), sans-serif",
  head: "var(--font-archivo), sans-serif",
  body: "var(--font-space), sans-serif",
  mono: "var(--font-mono), monospace",
} as const
