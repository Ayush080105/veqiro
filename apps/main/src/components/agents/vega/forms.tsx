"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  FormRow,
  CountedTextarea,
} from "@/components/chat/ActionForm/fields"
import type {
  VegaProcessInboxRequest,
  VegaDraftReplyRequest,
  VegaCalendarSummaryRequest,
  VegaCreateEventRequest,
  VegaExecutiveBriefingRequest,
} from "@/lib/types/agents"

export function VegaProcessInboxForm({
  value,
  onChange,
}: {
  value: VegaProcessInboxRequest
  onChange: (patch: Partial<VegaProcessInboxRequest>) => void
}) {
  return (
    <>
      <FormRow label="How many emails?">
        <Input
          type="number"
          min={1}
          max={100}
          value={value.max_emails ?? 20}
          onChange={(e) => onChange({ max_emails: Number(e.target.value) })}
        />
      </FormRow>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-xs">
          <Switch
            checked={value.auto_label ?? true}
            onCheckedChange={(v) => onChange({ auto_label: v })}
          />
          Auto-label
        </label>
        <label className="flex items-center gap-2 text-xs">
          <Switch
            checked={value.draft_replies ?? false}
            onCheckedChange={(v) => onChange({ draft_replies: v })}
          />
          Draft replies
        </label>
      </div>
    </>
  )
}

export function VegaDraftReplyForm({
  value,
  onChange,
}: {
  value: VegaDraftReplyRequest
  onChange: (patch: Partial<VegaDraftReplyRequest>) => void
}) {
  return (
    <>
      <FormRow label="Email ID" required hint="From a prior Process Inbox result.">
        <Input
          value={value.email_id}
          onChange={(e) => onChange({ email_id: e.target.value })}
          placeholder="e.g. 192f…"
        />
      </FormRow>
      <FormRow label="Reply instructions" required>
        <CountedTextarea
          value={value.reply_instructions}
          rows={3}
          onChange={(v) => onChange({ reply_instructions: v })}
          placeholder="What should Vega say in the reply?"
        />
      </FormRow>
      <FormRow label="Tone">
        <Input
          value={value.tone ?? ""}
          placeholder="e.g. warm, professional"
          onChange={(e) => onChange({ tone: e.target.value })}
        />
      </FormRow>
      <label className="flex items-center gap-2 text-xs">
        <Switch
          checked={value.save_as_draft ?? true}
          onCheckedChange={(v) => onChange({ save_as_draft: v })}
        />
        Save as Gmail draft
      </label>
    </>
  )
}

export function VegaCalendarSummaryForm({
  value,
  onChange,
}: {
  value: VegaCalendarSummaryRequest
  onChange: (patch: Partial<VegaCalendarSummaryRequest>) => void
}) {
  return (
    <FormRow label="Days ahead">
      <Input
        type="number"
        min={1}
        max={30}
        value={value.days_ahead ?? 7}
        onChange={(e) => onChange({ days_ahead: Number(e.target.value) })}
      />
    </FormRow>
  )
}

export function VegaCreateEventForm({
  value,
  onChange,
}: {
  value: VegaCreateEventRequest
  onChange: (patch: Partial<VegaCreateEventRequest>) => void
}) {
  return (
    <>
      <FormRow label="Describe the event" required>
        <CountedTextarea
          value={value.description}
          rows={3}
          onChange={(v) => onChange({ description: v })}
          placeholder="e.g. 30-min intro call with Alex from Acme next Tuesday at 2pm"
        />
      </FormRow>
      <label className="flex items-center gap-2 text-xs">
        <Switch
          checked={value.check_conflicts ?? true}
          onCheckedChange={(v) => onChange({ check_conflicts: v })}
        />
        Check calendar conflicts
      </label>
    </>
  )
}

export function VegaExecutiveBriefingForm({
  value,
  onChange,
}: {
  value: VegaExecutiveBriefingRequest
  onChange: (patch: Partial<VegaExecutiveBriefingRequest>) => void
}) {
  return (
    <div className="flex flex-wrap gap-4">
      <label className="flex items-center gap-2 text-xs">
        <Switch
          checked={value.include_email ?? true}
          onCheckedChange={(v) => onChange({ include_email: v })}
        />
        Include email
      </label>
      <label className="flex items-center gap-2 text-xs">
        <Switch
          checked={value.include_calendar ?? true}
          onCheckedChange={(v) => onChange({ include_calendar: v })}
        />
        Include calendar
      </label>
    </div>
  )
}
