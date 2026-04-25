"use client"

import * as React from "react"
import { Bookmark, Brain } from "lucide-react"
import { Input } from "@/components/ui/input"
import { FormRow, StringListInput } from "@/components/chat/ActionForm/fields"
import { cn } from "@/lib/utils"
import { useCompetitorWatches } from "@/lib/api/scout"
import type {
  ScoutResearchTopicRequest,
  ScoutResearchCompanyRequest,
  ScoutTrendingTopicsRequest,
  ScoutDiscoverCompetitorsRequest,
} from "@/lib/types/agents"

export function ScoutResearchTopicForm({
  value,
  onChange,
}: {
  value: ScoutResearchTopicRequest
  onChange: (patch: Partial<ScoutResearchTopicRequest>) => void
}) {
  const depths: Array<"quick" | "standard" | "deep"> = ["quick", "standard", "deep"]
  return (
    <>
      <FormRow label="Topic" required>
        <Input
          value={value.topic}
          onChange={(e) => onChange({ topic: e.target.value })}
          placeholder="e.g. vibe-coding tools for startup founders"
        />
      </FormRow>
      <FormRow label="Depth">
        <div className="flex gap-1.5">
          {depths.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onChange({ depth: d })}
              className={cn(
                "flex-1 border border-border px-2 py-1.5 text-xs capitalize",
                (value.depth ?? "standard") === d
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-muted"
              )}
            >
              {d}
            </button>
          ))}
        </div>
      </FormRow>
      <FormRow label="Source hints" hint="Optional URLs Scout should include.">
        <StringListInput
          type="url"
          value={value.sources_hint ?? []}
          onChange={(next) => onChange({ sources_hint: next })}
          placeholder="https://…"
        />
      </FormRow>
    </>
  )
}

export function ScoutResearchCompanyForm({
  value,
  onChange,
}: {
  value: ScoutResearchCompanyRequest
  onChange: (patch: Partial<ScoutResearchCompanyRequest>) => void
}) {
  return (
    <>
      <FormRow label="Company name" required>
        <Input
          value={value.company_name}
          onChange={(e) => onChange({ company_name: e.target.value })}
          placeholder="e.g. Notion"
        />
      </FormRow>
      <FormRow label="Company URL" hint="Helps Scout lock onto the right company.">
        <Input
          type="url"
          value={value.company_url ?? ""}
          placeholder="https://notion.so"
          onChange={(e) => onChange({ company_url: e.target.value })}
        />
      </FormRow>
    </>
  )
}

export function ScoutTrendingTopicsForm({
  value,
  onChange,
}: {
  value: ScoutTrendingTopicsRequest
  onChange: (patch: Partial<ScoutTrendingTopicsRequest>) => void
}) {
  return (
    <>
      <FormRow label="Industry" required>
        <Input
          value={value.industry}
          onChange={(e) => onChange({ industry: e.target.value })}
          placeholder="e.g. developer tools"
        />
      </FormRow>
      <FormRow label="How many?">
        <Input
          type="number"
          min={3}
          max={25}
          value={value.count ?? 10}
          onChange={(e) => onChange({ count: Number(e.target.value) })}
        />
      </FormRow>
    </>
  )
}

export function ScoutDiscoverCompetitorsForm({
  value,
  onChange,
}: {
  value: ScoutDiscoverCompetitorsRequest
  onChange: (patch: Partial<ScoutDiscoverCompetitorsRequest>) => void
}) {
  const { data: saved = [] } = useCompetitorWatches()

  return (
    <>
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Brain className="size-3 shrink-0" />
        Using your product description and industry from Brain.
      </p>
      <FormRow label="How many competitors?">
        <Input
          type="number"
          min={3}
          max={15}
          value={value.count ?? 8}
          onChange={(e) => onChange({ count: Number(e.target.value) })}
        />
      </FormRow>
      {saved.length > 0 && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Bookmark className="size-3" />
          {saved.length} competitor{saved.length !== 1 ? "s" : ""} already in your watchlist
        </p>
      )}
    </>
  )
}
