"use client"

import { useEffect } from "react"
import Link from "next/link"
import { TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"

/**
 * The workspace shell itself failed (header, switcher, providers).
 *
 * Without this boundary a throw anywhere under (workspace) fell through to the
 * app-level error page — "Something went sideways" replacing the whole screen
 * with no way back to the console. The module-level boundary in
 * workspace/[agent]/error.tsx handles module failures while keeping the shell;
 * this one is the backstop for the shell.
 */
export default function WorkspaceShellError({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  reset: () => void
  unstable_retry?: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="grid min-h-dvh place-items-center bg-background p-6">
      <div className="flex flex-col items-center gap-3">
        <EmptyState
          icon={<TriangleAlert />}
          title="This workspace hit a snag"
          description="Try again, or go back to your employees."
        />
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="sm" onClick={() => (unstable_retry ?? reset)()}>
            Try again
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/assistants">Back to employees</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
