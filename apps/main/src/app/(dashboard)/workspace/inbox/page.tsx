import { InboxView } from "@/components/vega/InboxView"
import { PageHeader } from "@/components/ui/page-header"

export default function InboxPage() {
  return (
    <div className="flex flex-col h-full min-h-0 gap-4 pb-4">
      <PageHeader
        kicker="vega"
        title="smart inbox"
        subtitle="AI-triaged email — reply, schedule, or follow up without leaving Veqiro."
        sticker={{ label: "inbox", rot: 3, color: "var(--vq-violet)" }}
      />
      <div className="flex-1 min-h-0 overflow-hidden rounded-xl" style={{ border: "2.5px solid #111", boxShadow: "4px 4px 0 #111" }}>
        <InboxView />
      </div>
    </div>
  )
}
