import Link from "next/link"
import { MessageCircle, Plug } from "lucide-react"

import { EmptyState } from "@/components/ui/empty-state"
import { Sticker } from "@/components/ui/sticker"

export default function AssistantsIndexPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-background px-6 py-10">
      <div className="relative w-full max-w-md">
        <div className="absolute -top-5 left-6 z-10">
          <Sticker rotate={-6} tone="yellow">pick a chat</Sticker>
        </div>
        <EmptyState
          icon={<MessageCircle />}
          title="who's up?"
          description="Pick an assistant on the left to open the conversation. Each one has a specialty and a personality — just say hi."
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
