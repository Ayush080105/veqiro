"use client"

import { PageHeader } from "@/components/ui/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PlaysSection } from "@/components/tasks/PlaysSection"
import { TriggersSection } from "@/components/tasks/TriggersSection"

/**
 * Everything that runs without someone asking, in one place.
 *
 * Recurring work is a catalogue of plays the owner switches on, and triggers
 * cover the case scheduling never could: acting when something actually happens.
 */
export default function TasksPage() {
  return (
    <div className="flex min-w-0 flex-col gap-6 pb-10">
      <PageHeader
        title="Tasks"
        subtitle="Work your agents do on their own, on a schedule or when something happens."
      />

      <Tabs defaultValue="recurring" className="gap-4">
        <div className="flex items-center justify-between gap-4">
          <TabsList className="border border-[var(--vq-line-2)] bg-card">
            <TabsTrigger value="recurring">Recurring</TabsTrigger>
            <TabsTrigger value="triggers">Triggers</TabsTrigger>
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
