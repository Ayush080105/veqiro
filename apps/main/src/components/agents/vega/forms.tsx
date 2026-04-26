"use client"

import * as React from "react"
import { Controller } from "react-hook-form"

import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { FieldGroup } from "@/components/ui/field"
import { CountedTextarea } from "@/components/chat/ActionForm/fields"
import { RhfField } from "@/components/forms/RhfField"
import { useAgentForm } from "@/components/forms/useAgentForm"
import {
  vegaProcessInboxSchema,
  type VegaProcessInboxValues,
  vegaDraftReplySchema,
  type VegaDraftReplyValues,
  vegaCalendarSummarySchema,
  type VegaCalendarSummaryValues,
  vegaCreateEventSchema,
  type VegaCreateEventValues,
  vegaExecutiveBriefingSchema,
  type VegaExecutiveBriefingValues,
  vegaComposeEmailSchema,
  type VegaComposeEmailValues,
} from "@/lib/schemas/agents/vega"

// ─── Process inbox ──────────────────────────────────────────────────────────

export function VegaProcessInboxForm({
  value,
  onChange,
}: {
  value: VegaProcessInboxValues
  onChange: (patch: Partial<VegaProcessInboxValues>) => void
}) {
  const form = useAgentForm({
    schema: vegaProcessInboxSchema,
    defaultValue: value,
    onChange,
  })

  return (
    <FieldGroup>
      <RhfField
        control={form.control}
        name="max_emails"
        label="How many emails?"
      >
        {({ field, invalid, id }) => (
          <Input
            id={id}
            type="number"
            min={1}
            max={100}
            value={field.value ?? 20}
            onChange={(e) => field.onChange(Number(e.target.value))}
            onBlur={field.onBlur}
            aria-invalid={invalid}
          />
        )}
      </RhfField>

      <div className="flex flex-wrap gap-4">
        <Controller
          control={form.control}
          name="auto_label"
          render={({ field }) => (
            <label className="flex items-center gap-2 text-xs">
              <Switch
                checked={field.value ?? true}
                onCheckedChange={field.onChange}
              />
              Auto-label
            </label>
          )}
        />
        <Controller
          control={form.control}
          name="draft_replies"
          render={({ field }) => (
            <label className="flex items-center gap-2 text-xs">
              <Switch
                checked={field.value ?? false}
                onCheckedChange={field.onChange}
              />
              Draft replies
            </label>
          )}
        />
      </div>
    </FieldGroup>
  )
}

// ─── Draft reply ────────────────────────────────────────────────────────────

export function VegaDraftReplyForm({
  value,
  onChange,
}: {
  value: VegaDraftReplyValues
  onChange: (patch: Partial<VegaDraftReplyValues>) => void
}) {
  const form = useAgentForm({
    schema: vegaDraftReplySchema,
    defaultValue: value,
    onChange,
  })

  return (
    <FieldGroup>
      <RhfField
        control={form.control}
        name="email_id"
        label="Email ID"
        required
        description="From a prior Process Inbox result."
      >
        {({ field, invalid, id }) => (
          <Input
            {...field}
            id={id}
            placeholder="e.g. 192f…"
            aria-invalid={invalid}
          />
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="reply_instructions"
        label="Reply instructions"
        required
      >
        {({ field }) => (
          <CountedTextarea
            value={field.value}
            rows={3}
            onChange={field.onChange}
            placeholder="What should Vega say in the reply?"
          />
        )}
      </RhfField>

      <RhfField control={form.control} name="tone" label="Tone">
        {({ field, invalid, id }) => (
          <Input
            {...field}
            id={id}
            value={field.value ?? ""}
            placeholder="e.g. warm, professional"
            aria-invalid={invalid}
          />
        )}
      </RhfField>

      <Controller
        control={form.control}
        name="save_as_draft"
        render={({ field }) => (
          <label className="flex items-center gap-2 text-xs">
            <Switch
              checked={field.value ?? true}
              onCheckedChange={field.onChange}
            />
            Save as Gmail draft
          </label>
        )}
      />
    </FieldGroup>
  )
}

// ─── Calendar summary ───────────────────────────────────────────────────────

export function VegaCalendarSummaryForm({
  value,
  onChange,
}: {
  value: VegaCalendarSummaryValues
  onChange: (patch: Partial<VegaCalendarSummaryValues>) => void
}) {
  const form = useAgentForm({
    schema: vegaCalendarSummarySchema,
    defaultValue: value,
    onChange,
  })

  return (
    <FieldGroup>
      <RhfField control={form.control} name="days_ahead" label="Days ahead">
        {({ field, invalid, id }) => (
          <Input
            id={id}
            type="number"
            min={1}
            max={30}
            value={field.value ?? 7}
            onChange={(e) => field.onChange(Number(e.target.value))}
            onBlur={field.onBlur}
            aria-invalid={invalid}
          />
        )}
      </RhfField>
    </FieldGroup>
  )
}

// ─── Create event ───────────────────────────────────────────────────────────

export function VegaCreateEventForm({
  value,
  onChange,
}: {
  value: VegaCreateEventValues
  onChange: (patch: Partial<VegaCreateEventValues>) => void
}) {
  const form = useAgentForm({
    schema: vegaCreateEventSchema,
    defaultValue: value,
    onChange,
  })

  return (
    <FieldGroup>
      <RhfField
        control={form.control}
        name="description"
        label="Describe the event"
        required
      >
        {({ field }) => (
          <CountedTextarea
            value={field.value}
            rows={3}
            onChange={field.onChange}
            placeholder="e.g. 30-min intro call with Alex from Acme next Tuesday at 2pm"
          />
        )}
      </RhfField>

      <Controller
        control={form.control}
        name="check_conflicts"
        render={({ field }) => (
          <label className="flex items-center gap-2 text-xs">
            <Switch
              checked={field.value ?? true}
              onCheckedChange={field.onChange}
            />
            Check calendar conflicts
          </label>
        )}
      />
    </FieldGroup>
  )
}

// ─── Executive briefing ─────────────────────────────────────────────────────

export function VegaExecutiveBriefingForm({
  value,
  onChange,
}: {
  value: VegaExecutiveBriefingValues
  onChange: (patch: Partial<VegaExecutiveBriefingValues>) => void
}) {
  const form = useAgentForm({
    schema: vegaExecutiveBriefingSchema,
    defaultValue: value,
    onChange,
  })

  return (
    <div className="flex flex-wrap gap-4">
      <Controller
        control={form.control}
        name="include_email"
        render={({ field }) => (
          <label className="flex items-center gap-2 text-xs">
            <Switch
              checked={field.value ?? true}
              onCheckedChange={field.onChange}
            />
            Include email
          </label>
        )}
      />
      <Controller
        control={form.control}
        name="include_calendar"
        render={({ field }) => (
          <label className="flex items-center gap-2 text-xs">
            <Switch
              checked={field.value ?? true}
              onCheckedChange={field.onChange}
            />
            Include calendar
          </label>
        )}
      />
    </div>
  )
}

// ─── Compose email ──────────────────────────────────────────────────────────

export function VegaComposeEmailForm({
  value,
  onChange,
}: {
  value: VegaComposeEmailValues
  onChange: (patch: Partial<VegaComposeEmailValues>) => void
}) {
  const form = useAgentForm({
    schema: vegaComposeEmailSchema,
    defaultValue: value,
    onChange,
  })

  return (
    <FieldGroup>
      <RhfField control={form.control} name="to" label="To" required>
        {({ field, invalid, id }) => (
          <Input
            {...field}
            id={id}
            type="email"
            placeholder="recipient@example.com"
            aria-invalid={invalid}
          />
        )}
      </RhfField>

      <RhfField control={form.control} name="subject" label="Subject" required>
        {({ field, invalid, id }) => (
          <Input
            {...field}
            id={id}
            placeholder="Monthly investor update — March"
            aria-invalid={invalid}
          />
        )}
      </RhfField>

      <RhfField
        control={form.control}
        name="instructions"
        label="Instructions"
        required
      >
        {({ field }) => (
          <CountedTextarea
            value={field.value}
            rows={5}
            onChange={field.onChange}
            placeholder="What should Vega say? Include the key points and any numbers."
          />
        )}
      </RhfField>

      <RhfField control={form.control} name="tone" label="Tone">
        {({ field, invalid, id }) => (
          <Input
            {...field}
            id={id}
            value={field.value ?? ""}
            placeholder="e.g. professional and enthusiastic"
            aria-invalid={invalid}
          />
        )}
      </RhfField>

      <Controller
        control={form.control}
        name="include_cta"
        render={({ field }) => (
          <label className="flex items-center gap-2 text-xs">
            <Switch
              checked={field.value ?? true}
              onCheckedChange={field.onChange}
            />
            Include a clear CTA
          </label>
        )}
      />
    </FieldGroup>
  )
}
