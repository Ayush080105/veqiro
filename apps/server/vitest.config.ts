import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Every test lives under src/. Previously the npm script passed
    // "src/tests/unit/*.test.ts" as a positional arg, but vitest treats
    // positionals as path FILTERS, not globs — no path contains that literal
    // string, so the entire unit suite silently never ran. Only
    // scout.test.ts matched (it was passed as a literal path).
    include: ["src/**/*.test.ts"],
    exclude: [
      "**/node_modules/**",
      // dist/ holds compiled .test.js copies from `tsc`. Without an explicit
      // exclude, vitest collects those stale duplicates alongside the real
      // sources and they fail on import.
      "**/dist/**",
      // Empty `// TODO: implement` + `export {}` placeholders. Vitest fails a
      // file that declares no tests ("No test suite found"), so these four
      // would redden the suite forever.
      // DELETE THE CORRESPONDING LINE HERE when you write real tests in one,
      // otherwise it will silently never run.
      "src/modules/agents/lex/lex.test.ts",
      "src/modules/agents/maya/maya.test.ts",
      "src/modules/agents/sage/sage.test.ts",
      "src/modules/agents/vega/vega.test.ts",
    ],
  },
});
