"use client"

import * as React from "react"
import { Brain, MapPin, Plus, X } from "lucide-react"
import { useFieldArray } from "react-hook-form"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { StringListInput, FormRow } from "@/components/chat/ActionForm/fields"
import { RhfField } from "@/components/forms/RhfField"
import { useAgentForm } from "@/components/forms/useAgentForm"
import { cn } from "@/lib/utils"
import type {
  ScoutDiscoverCompetitorsRequest,
} from "@/lib/types/agents"
import {
  scoutResearchTopicSchema,
  type ScoutResearchTopicValues,
  scoutResearchCompanySchema,
  type ScoutResearchCompanyValues,
  scoutCompetitorScanSchema,
  type ScoutCompetitorScanValues,
  scoutTrendingTopicsSchema,
  type ScoutTrendingTopicsValues,
  SCOUT_DEPTHS,
} from "@/lib/schemas/agents/scout"

// ─── Research topic ─────────────────────────────────────────────────────────

export function ScoutResearchTopicForm({
  value,
  onChange,
}: {
  value: ScoutResearchTopicValues
  onChange: (patch: Partial<ScoutResearchTopicValues>) => void
}) {
  const form = useAgentForm({
    schema: scoutResearchTopicSchema,
    defaultValue: value,
    onChange,
  })

  return (
    <FieldGroup>
      <RhfField control={form.control} name="topic" label="Topic" required>
        {({ field, invalid, id }) => (
          <Input
            {...field}
            id={id}
            placeholder="e.g. vibe-coding tools for startup founders"
            aria-invalid={invalid}
          />
        )}
      </RhfField>

      <RhfField control={form.control} name="depth" label="Depth">
        {({ field }) => (
          <div className="flex gap-1.5">
            {SCOUT_DEPTHS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => field.onChange(d)}
                className={cn(
                  "flex-1 border border-border px-2 py-1.5 text-xs capitalize",
                  (field.value ?? "standard") === d
                    ? "bg-primary text-primary-foreground border-primary"
                    : "hover:bg-muted"
                )}
              >
                {d}
              </button>
            ))}
          </div>
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="sources_hint"
        label="Source hints"
        description="Optional URLs Scout should include."
      >
        {({ field }) => (
          <StringListInput
            type="url"
            value={field.value ?? []}
            onChange={field.onChange}
            placeholder="https://…"
          />
        )}
      </RhfField>
    </FieldGroup>
  )
}

// ─── Research company ───────────────────────────────────────────────────────

export function ScoutResearchCompanyForm({
  value,
  onChange,
}: {
  value: ScoutResearchCompanyValues
  onChange: (patch: Partial<ScoutResearchCompanyValues>) => void
}) {
  const form = useAgentForm({
    schema: scoutResearchCompanySchema,
    defaultValue: value,
    onChange,
  })

  return (
    <FieldGroup>
      <RhfField
        control={form.control}
        name="company_name"
        label="Company name"
        required
      >
        {({ field, invalid, id }) => (
          <Input
            {...field}
            id={id}
            placeholder="e.g. Notion"
            aria-invalid={invalid}
          />
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="company_url"
        label="Company URL"
        description="Helps Scout lock onto the right company."
      >
        {({ field, invalid, id }) => (
          <Input
            {...field}
            id={id}
            type="url"
            value={field.value ?? ""}
            placeholder="https://notion.so"
            aria-invalid={invalid}
          />
        )}
      </RhfField>
    </FieldGroup>
  )
}

// ─── Competitor scan ────────────────────────────────────────────────────────

export function ScoutCompetitorScanForm({
  value,
  onChange,
}: {
  value: ScoutCompetitorScanValues
  onChange: (patch: Partial<ScoutCompetitorScanValues>) => void
}) {
  const form = useAgentForm({
    schema: scoutCompetitorScanSchema,
    defaultValue: value,
    onChange,
  })
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "competitors",
  })

  return (
    <FieldGroup>
      <RhfField
        control={form.control}
        name="competitors"
        label="Competitors to watch"
        required
      >
        {() => (
          <div className="flex flex-col gap-1.5">
            {fields.map((row, i) => (
              <div key={row.id} className="flex gap-1.5">
                <Input
                  {...form.register(`competitors.${i}.name`)}
                  placeholder="Name"
                  className="flex-1"
                />
                <Input
                  {...form.register(`competitors.${i}.url`)}
                  type="url"
                  placeholder="https://…"
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
              onClick={() => append({ name: "", url: "" })}
              className="self-start"
            >
              <Plus data-icon="inline-start" /> Add competitor
            </Button>
          </div>
        )}
      </RhfField>
    </FieldGroup>
  )
}

// ─── Trending topics ────────────────────────────────────────────────────────

export function ScoutTrendingTopicsForm({
  value,
  onChange,
}: {
  value: ScoutTrendingTopicsValues
  onChange: (patch: Partial<ScoutTrendingTopicsValues>) => void
}) {
  const form = useAgentForm({
    schema: scoutTrendingTopicsSchema,
    defaultValue: value,
    onChange,
  })

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
      <FormRow label="Location" hint="Optional — narrow to a region or leave blank for global">
        <Input
          value={value.location ?? ""}
          onChange={(e) => onChange({ location: e.target.value })}
          placeholder="e.g. India, Europe, Southeast Asia"
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
  return (
    <>
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Brain className="size-3 shrink-0" />
        Using your product description and industry from Brain.
      </p>
      {value.location && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <MapPin className="size-3 shrink-0" />
          Searching in: {value.location}
        </p>
      )}
      <FormRow label="How many competitors?">
        <Input
          type="number"
          min={3}
          max={15}
          value={value.count ?? 8}
          onChange={(e) => onChange({ count: Number(e.target.value) })}
        />
      </FormRow>
    </>
  )
}
