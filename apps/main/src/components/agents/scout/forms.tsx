"use client"

import * as React from "react"
import { Plus, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { FormRow, StringListInput } from "@/components/chat/ActionForm/fields"
import { cn } from "@/lib/utils"
import type {
  ScoutResearchTopicRequest,
  ScoutResearchCompanyRequest,
  ScoutCompetitorScanRequest,
  ScoutTrendingTopicsRequest,
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

export function ScoutCompetitorScanForm({
  value,
  onChange,
}: {
  value: ScoutCompetitorScanRequest
  onChange: (patch: Partial<ScoutCompetitorScanRequest>) => void
}) {
  const rows = value.competitors ?? []
  const update = (i: number, patch: Partial<(typeof rows)[number]>) =>
    onChange({
      competitors: rows.map((r, j) => (j === i ? { ...r, ...patch } : r)),
    })
  const add = () =>
    onChange({ competitors: [...rows, { name: "", url: "" }] })
  const remove = (i: number) =>
    onChange({ competitors: rows.filter((_, j) => j !== i) })

  return (
    <FormRow label="Competitors to watch" required>
      <div className="flex flex-col gap-1.5">
        {rows.map((r, i) => (
          <div key={i} className="flex gap-1.5">
            <Input
              value={r.name}
              placeholder="Name"
              onChange={(e) => update(i, { name: e.target.value })}
              className="flex-1"
            />
            <Input
              type="url"
              value={r.url}
              placeholder="https://…"
              onChange={(e) => update(i, { url: e.target.value })}
              className="flex-[2]"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remove(i)}
              aria-label="Remove"
            >
              <X />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={add}
          className="self-start"
        >
          <Plus data-icon="inline-start" /> Add competitor
        </Button>
      </div>
    </FormRow>
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
