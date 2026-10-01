"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"

/**
 * A module failed to render.
 *
 * This sits INSIDE the [agent] layout, so the header, module rail and chat dock
 * stay mounted and only the module body is replaced — one broken widget must
 * not take the customer's draft and their way out with it. (An error.tsx is
 * fine at this level; a loading.tsx or template.tsx would not be. See
 * scripts/check-workspace-invariants.mjs.)
 *
 * Next 16 recommends `unstable_retry` (re-fetch + re-render); `reset` remains
 * as the fallback for older behaviour.
 */
export default function WorkspaceModuleError({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  reset: () => void
  unstable_retry?: () => void
}) {
  const params = useParams<{ agent: string }>()

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center gap-3">
      <EmptyState
        icon={<TriangleAlert />}
        title="This section hit a snag"
        description="The rest of the workspace is fine. Try again, or head back to the overview."
      />
      <div className="flex flex-wrap justify-center gap-2">
        <Button size="sm" onClick={() => (unstable_retry ?? reset)()}>
          Try again
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={`/workspace/${params.agent}/overview`}>Overview</Link>
        </Button>
      </div>
    </div>
  )
}
