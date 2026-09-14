import Link from "next/link"
import { MessageCircle, Plug } from "lucide-react"

import { EmptyState } from "@/components/ui/empty-state"

export default function AssistantsIndexPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-md">
        <EmptyState
          icon={<MessageCircle />}
          title="Choose an assistant"
          description="Pick an assistant on the left to open a focused workspace for chat, tools, and follow-up actions."
        />
        <div className="mt-3 flex justify-center">
          <Link
            href="/settings/integrations"
            data-tour="onboard-me-button"
            className="flex items-center gap-1.5 text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
          >
            <Plug className="size-3.5" />
            Connect your tools
          </Link>
        </div>
      </div>
    </div>
  )
}
