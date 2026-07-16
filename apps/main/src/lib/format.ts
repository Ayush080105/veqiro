/** Formats cents as a dollar string, dropping a bare ".00" but keeping real cents (e.g. 950 -> "$9.50", 3900 -> "$39"). */
export function money(cents: number): string {
  return `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`
}
