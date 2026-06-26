import { InboxView } from "@/components/vega/InboxView"
import { PageHeader } from "@/components/ui/page-header"
import { FeatureLockBanner } from "@/components/ui/feature-lock-banner"
import { GOOGLE_FEATURES_LOCKED } from "@/lib/config/features"

export default function InboxPage() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 pb-4">
      <PageHeader
        kicker="vega"
        title="smart inbox"
        subtitle="A Gmail-style command center for priority mail, full threads, replies, meetings, and follow-ups."
        sticker={{ label: "inbox", rot: 3, color: "var(--vq-violet)" }}
      />
      <div
        className="min-h-0 flex-1 overflow-hidden rounded-xl"
        style={{ border: "2.5px solid #111", boxShadow: "4px 4px 0 #111" }}
      >
        {GOOGLE_FEATURES_LOCKED ? (
          <FeatureLockBanner
            title="smart inbox"
            description="Vega uses Gmail access to triage your emails, surface priorities, and manage follow-ups."
          />
        ) : (
          <InboxView />
        )}
      </div>
    </div>
  )
}
