/**
 * Font roles and design-system color/shadow tokens as plain data.
 *
 * Deliberately NOT in shared.tsx: that file is 'use client', and a Server
 * Component that imports a plain value (not a component) from a client-
 * boundary module gets an opaque client reference back, not the real value —
 * `T.amber` silently evaluates to `undefined` there instead of throwing,
 * which is exactly the kind of bug that only shows up visually, never in a
 * type or lint check. Server Components (pages/layouts without 'use client')
 * must import FONT/T from here directly, never through shared.tsx.
 */

export const FONT = {
  display: "var(--font-display), system-ui, sans-serif",
  head: "var(--font-display), system-ui, sans-serif",
  body: "var(--font-body), system-ui, sans-serif",
  mono: "var(--font-mono), monospace",
};

export const T = {
  bg: 'var(--vq-bg)',
  surface: 'var(--vq-surface)',
  surface2: 'var(--vq-surface-2)',
  dark: 'var(--vq-dark)',
  dark2: 'var(--vq-dark-2)',
  dark3: 'var(--vq-dark-3)',
  ink: 'var(--vq-ink)',
  ink2: 'var(--vq-ink-2)',
  ink3: 'var(--vq-ink-3)',
  inkInv: 'var(--vq-ink-inv)',
  inkInv2: 'var(--vq-ink-inv-2)',
  line: 'var(--vq-line)',
  line2: 'var(--vq-line-2)',
  lineInv: 'var(--vq-line-inv)',
  lineInv2: 'var(--vq-line-inv-2)',
  amber: 'var(--vq-amber)',
  red: 'var(--vq-red)',
  green: 'var(--vq-green)',
  pink: 'var(--vq-pink)',
  violet: 'var(--vq-violet)',
  blue: 'var(--vq-blue)',
  shadowSm: 'var(--vq-shadow-sm)',
  shadow: 'var(--vq-shadow)',
  shadowLg: 'var(--vq-shadow-lg)',
  r: 12,
  rLg: 16,
} as const;
