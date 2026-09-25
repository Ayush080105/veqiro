/**
 * Where the chat can live, decided by viewport width. Pure so the interesting
 * numbers are testable without a browser.
 *
 * Layout itself stays in CSS classes (no hydration flash); this only backs the
 * logic that must know — "can the dock be shown here?", "how wide may it get?".
 */

export type DockPlacement = "none" | "overlay" | "inline"

export const DOCK_MIN = 320
export const DOCK_MAX = 720
export const DOCK_DEFAULT = 380
/** Width of the module rail (`w-52`). */
export const RAIL_WIDTH = 208
/** The narrowest the module body may get before it stops being usable. */
export const MODULE_MIN = 520
/** Tailwind `lg`. */
export const OVERLAY_AT = 1024
/** Tailwind `xl`. */
export const INLINE_AT = 1280

/**
 * Below `lg` there is no dock (a docked column beside a module is not a phone
 * layout) — chat is the Chat page there. Between `lg` and `xl` it floats over
 * the module instead of squeezing it, because rail + dock would leave ~450px
 * for the work itself.
 */
export function dockPlacement(viewportWidth: number): DockPlacement {
  if (viewportWidth < OVERLAY_AT) return "none"
  if (viewportWidth < INLINE_AT) return "overlay"
  return "inline"
}

export function clampDockWidth(width: number, viewportWidth: number): number {
  const ceiling = Math.min(DOCK_MAX, viewportWidth - RAIL_WIDTH - MODULE_MIN)
  return Math.round(Math.min(Math.max(width, DOCK_MIN), Math.max(ceiling, DOCK_MIN)))
}

export function parseStoredWidth(raw: string | null): number | null {
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * A saved dock width, made safe for the current viewport. Storage is
 * user-editable and a width saved on a wide monitor is wrong on a laptop, so a
 * stored value is never trusted as-is: garbage falls back to the default, and
 * anything else is clamped (a corrupt "99999" must not squeeze the module to 0).
 */
export function resolveStoredWidth(raw: string | null, viewportWidth: number): number {
  return clampDockWidth(parseStoredWidth(raw) ?? DOCK_DEFAULT, viewportWidth)
}

/**
 * Whether Escape should close the floating (lg–xl) dock. It must not, when the
 * same keypress is meant for a dialog, menu or picker opened from inside it —
 * closing the panel the customer is working in would be the wrong reading of
 * "cancel this popup".
 */
export function escapeClosesDock({
  defaultPrevented,
  otherLayerOpen,
}: {
  defaultPrevented: boolean
  otherLayerOpen: boolean
}): boolean {
  return !defaultPrevented && !otherLayerOpen
}
