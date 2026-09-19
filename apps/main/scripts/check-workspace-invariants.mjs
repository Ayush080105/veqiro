#!/usr/bin/env node
/**
 * Two invariants that are invisible when broken.
 *
 * 1. No loading.tsx or template.tsx at the [agent] level of the workspace.
 *    Either one puts a Suspense/remount boundary above the chat dock, so the
 *    customer's half-typed message is silently discarded on every navigation.
 *    Per-module loading.tsx is fine and is why this checks the level, not the
 *    filename alone.
 *
 * 2. No agent slug literals in the workspace framework. The registry and the
 *    default modules must stay agent-agnostic; the moment one says
 *    `agent === "maya"`, this is the old isMaya branching with indirection on
 *    top. Agent-specific code belongs in lib/workspace/agents/ or in that
 *    agent's own components.
 *
 * Run: node scripts/check-workspace-invariants.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")
const AGENT_DIR = join(ROOT, "src/app/(dashboard)/workspace/[agent]")
const FRAMEWORK_FILES = [
  join(ROOT, "src/lib/workspace/registry.ts"),
  join(ROOT, "src/lib/workspace/modules.ts"),
  join(ROOT, "src/lib/workspace/types.ts"),
  join(ROOT, "src/components/workspace/ModuleHost.tsx"),
  join(ROOT, "src/components/workspace/ModuleNav.tsx"),
  join(ROOT, "src/components/workspace/WorkspaceShell.tsx"),
]
const AGENT_SLUGS = ["maya", "rex", "sage", "scout", "lex", "vega"]

const failures = []

// ── 1. boundary files ────────────────────────────────────────────────────────
try {
  for (const entry of readdirSync(AGENT_DIR)) {
    if (entry === "loading.tsx" || entry === "template.tsx") {
      failures.push(
        `${relative(ROOT, join(AGENT_DIR, entry))} breaks chat-dock persistence. ` +
          `A boundary at the [agent] level re-suspends or remounts the dock on every ` +
          `module navigation. Put loading.tsx inside the module folder instead.`,
      )
    }
  }
} catch {
  // The workspace routes not existing is not this script's problem.
}

// A template.tsx anywhere under workspace/ remounts its subtree.
const walk = (dir) => {
  let found = []
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return found
  }
  for (const entry of entries) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) found = found.concat(walk(full))
    else if (entry === "template.tsx") found.push(full)
  }
  return found
}
for (const file of walk(join(ROOT, "src/app/(dashboard)/workspace"))) {
  failures.push(
    `${relative(ROOT, file)} remounts its subtree by definition — no template.tsx under workspace/.`,
  )
}

// ── 2. agent slugs in framework code ─────────────────────────────────────────
// Matches a slug used as a value ("maya" / 'maya'), not one appearing inside a
// longer identifier or a comment sentence.
const slugPattern = new RegExp(`["'](${AGENT_SLUGS.join("|")})["']`, "g")
for (const file of FRAMEWORK_FILES) {
  let source
  try {
    source = readFileSync(file, "utf8")
  } catch {
    continue
  }
  const code = source
    .split("\n")
    .filter((line) => {
      const t = line.trim()
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*")
    })
    .join("\n")

  const hits = [...code.matchAll(slugPattern)].map((m) => m[1])
  if (hits.length > 0) {
    failures.push(
      `${relative(ROOT, file)} names agents (${[...new Set(hits)].join(", ")}). ` +
        `Framework code must stay agent-agnostic — move this into ` +
        `lib/workspace/agents/<agent>.workspace.ts or that agent's own component.`,
    )
  }
}

if (failures.length > 0) {
  console.error("\nWorkspace invariant violations:\n")
  for (const failure of failures) console.error(`  ✗ ${failure}\n`)
  process.exit(1)
}

console.log("✓ workspace invariants hold")
