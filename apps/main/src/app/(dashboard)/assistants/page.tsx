import { MessageCircle } from "lucide-react"

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
      </div>
    </div>
  )
}
