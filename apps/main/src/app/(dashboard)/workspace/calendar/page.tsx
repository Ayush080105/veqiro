import { CalendarView } from "@/components/vega/CalendarView"
import { PageHeader } from "@/components/ui/page-header"
import { FeatureLockBanner } from "@/components/ui/feature-lock-banner"
import { GOOGLE_FEATURES_LOCKED } from "@/lib/config/features"

type SearchParams = Promise<{
  title?: string
  attendees?: string
  description?: string
}>

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const sp = await searchParams
  const attendees = sp.attendees
    ? sp.attendees
        .split(",")
        .map((email) => email.trim())
        .filter(Boolean)
    : []
  const prefill =
    sp.title || sp.attendees || sp.description
      ? {
          title: sp.title,
          attendees,
          description: sp.description,
        }
      : undefined

  return (
    <div className="flex flex-col h-full min-h-0 gap-4 pb-4">
      <PageHeader
        kicker="vega"
        title="smart calendar"
        subtitle="AI-powered scheduling - plan, prep, and follow up on every meeting."
        sticker={{ label: "calendar", rot: -3, color: "var(--vq-green)" }}
      />
      <div
        className="flex-1 min-h-0 overflow-hidden rounded-xl"
        style={{ border: "2.5px solid #111", boxShadow: "4px 4px 0 #111" }}
      >
        {GOOGLE_FEATURES_LOCKED ? (
          <FeatureLockBanner
            title="smart calendar"
            description="Vega uses Google Calendar access to schedule meetings, prep agendas, and send follow-ups."
          />
        ) : (
          <CalendarView initialPrefill={prefill} />
        )}
      </div>
    </div>
  )
}
