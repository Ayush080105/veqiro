"use client"

import { PageHeader } from "@/components/ui/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PlaysSection } from "@/components/tasks/PlaysSection"
import { TriggersSection } from "@/components/tasks/TriggersSection"

const FONT = { mono: "var(--font-mono)" }

/**
 * Everything that runs without someone asking, in one place.
 *
 * Replaces the previous Task system, which scheduled three fixed jobs per
 * organization and had no way to add a fourth. Recurring work is now a
 * catalogue of plays the owner switches on, and triggers cover the case
 * scheduling never could: acting when something actually happens.
 */
export default function TasksPage() {
  return (
    <div className="flex min-w-0 flex-col gap-6 pb-10">
      <PageHeader
        title="Tasks"
        subtitle="Work your agents do on their own — on a schedule, or when something happens."
      />

      <Tabs defaultValue="recurring">
        <div className="flex items-center justify-between gap-4 mb-4">
          <TabsList className="border border-[var(--vq-line-2)] bg-transparent h-9">
            <TabsTrigger
              value="recurring"
              style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: 1 }}
            >
              RECURRING
            </TabsTrigger>
            <TabsTrigger
              value="triggers"
              style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: 1 }}
            >
              TRIGGERS
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="recurring" className="mt-0">
          <PlaysSection />
        </TabsContent>

        <TabsContent value="triggers" className="mt-0">
          <TriggersSection />
        </TabsContent>
      </Tabs>
    </div>
  )
}
