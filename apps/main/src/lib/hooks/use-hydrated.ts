"use client"

import { useSyncExternalStore } from "react"

const subscribe = () => () => undefined

/**
 * False for the server render and the matching hydration pass, then true for
 * normal browser renders. This keeps fast external stores (such as Better
 * Auth's session store) from changing text while React is still hydrating.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false)
}
