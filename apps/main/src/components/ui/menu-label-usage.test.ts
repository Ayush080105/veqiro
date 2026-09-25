import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import test from "node:test"

/**
 * Base UI's Menu/Select GroupLabel throws ("MenuGroupRootContext is missing")
 * when rendered outside its Group. That throw reaches the app-level error
 * boundary and replaces the whole page with "Something went sideways" — which
 * is exactly how the workspace employee switcher broke.
 *
 * This is a static guard on purpose: there is no component-test harness in
 * this app, and the failure only happens when the menu is opened, so a normal
 * build and even a page load do not catch it.
 */

// Tests run from apps/main (`npx tsx --test src/...`).
const SRC = join(process.cwd(), "src")
const PAIRS: { label: string; group: string }[] = [
  { label: "DropdownMenuLabel", group: "DropdownMenuGroup" },
  { label: "SelectLabel", group: "SelectGroup" },
]

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue
      out.push(...walk(full))
    } else if (full.endsWith(".tsx") && !full.replaceAll("\\", "/").includes("components/ui/")) {
      out.push(full)
    }
  }
  return out
}

test("every DropdownMenuLabel / SelectLabel is rendered inside its Group", () => {
  const offenders: string[] = []
  for (const file of walk(SRC)) {
    const source = readFileSync(file, "utf8")
    for (const { label, group } of PAIRS) {
      const labelRe = new RegExp(`<${label}[\\s>]`, "g")
      let match: RegExpExecArray | null
      while ((match = labelRe.exec(source))) {
        const before = source.slice(0, match.index)
        const opened = (before.match(new RegExp(`<${group}[\\s>]`, "g")) ?? []).length
        const closed = (before.match(new RegExp(`</${group}>`, "g")) ?? []).length
        if (opened - closed <= 0) {
          const line = before.split("\n").length
          offenders.push(`${relative(SRC, file)}:${line} <${label}> is outside <${group}>`)
        }
      }
    }
  }
  assert.deepEqual(offenders, [])
})
