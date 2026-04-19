"use client"

import * as React from "react"
import { ActionDialog, type ActionResultContext } from "@/components/chat/ActionDialog"
import { findAction } from "@/lib/agents/actions"
import type { AgentActionId } from "@/lib/types/agents"

// Sage forms
import {
  SageKeywordResearchForm,
  SageGenerateBlogForm,
  SageAnalyzeContentForm,
  SageContentBriefForm,
} from "@/components/agents/sage/forms"
// Maya forms
import {
  MayaIdeationForm,
  MayaDraftForm,
  MayaVariantsForm,
  MayaReviseForm,
  MayaImageRegenForm,
  MayaContentRegenForm,
} from "@/components/agents/maya/forms"
// Scout forms
import {
  ScoutResearchTopicForm,
  ScoutResearchCompanyForm,
  ScoutCompetitorScanForm,
  ScoutTrendingTopicsForm,
} from "@/components/agents/scout/forms"
// Rex forms
import {
  RexAnalyzeMetricsForm,
  RexForecastForm,
  RexFinancialAnalysisForm,
  RexBriefingForm,
} from "@/components/agents/rex/forms"
// Lex forms
import {
  LexIngestDocumentForm,
  LexAnalyzeContractForm,
  LexDraftDocumentForm,
  LexExplainForm,
  LexLegalResearchForm,
  LexComplianceCheckForm,
} from "@/components/agents/lex/forms"
// Vega forms
import {
  VegaProcessInboxForm,
  VegaDraftReplyForm,
  VegaCalendarSummaryForm,
  VegaCreateEventForm,
  VegaExecutiveBriefingForm,
} from "@/components/agents/vega/forms"

type FormComponent = React.ComponentType<{
  value: any
  onChange: (patch: any) => void
}>

interface ActionSpec {
  defaultValue: unknown
  Form: FormComponent
  validate?: (v: any) => string | null
}

const today = () => new Date().toISOString().slice(0, 10)

const SPECS: Record<AgentActionId, ActionSpec> = {
  "sage:keyword-research": {
    defaultValue: { seed_topic: "", count: 20 },
    Form: SageKeywordResearchForm,
    validate: (v) => (v.seed_topic?.trim() ? null : "Seed topic is required."),
  },
  "sage:generate-blog": {
    defaultValue: {
      topic: "",
      target_keyword: "",
      secondary_keywords: [],
      word_count: 1500,
      output_format: "markdown",
      include_meta: true,
      include_schema_markup: false,
    },
    Form: SageGenerateBlogForm,
    validate: (v) =>
      !v.topic?.trim()
        ? "Topic is required."
        : !v.target_keyword?.trim()
          ? "Target keyword is required."
          : null,
  },
  "sage:analyze-content": {
    defaultValue: { content: "", target_keyword: "" },
    Form: SageAnalyzeContentForm,
    validate: (v) =>
      !v.content?.trim()
        ? "Content is required."
        : !v.target_keyword?.trim()
          ? "Target keyword is required."
          : null,
  },
  "sage:content-brief": {
    defaultValue: { topic: "", target_keyword: "", competitor_urls: [] },
    Form: SageContentBriefForm,
    validate: (v) =>
      !v.topic?.trim()
        ? "Topic is required."
        : !v.target_keyword?.trim()
          ? "Target keyword is required."
          : null,
  },

  "maya:generate-ideas": {
    defaultValue: { platform: "linkedin", count: 5 },
    Form: MayaIdeationForm,
  },
  "maya:draft-content": {
    defaultValue: {
      topic: "",
      platform: "linkedin",
      word_count_target: 200,
      include_image: true,
      use_logo: false,
      use_mascot: false,
    },
    Form: MayaDraftForm,
    validate: (v) => (v.topic?.trim() ? null : "Topic is required."),
  },
  "maya:generate-variants": {
    defaultValue: {
      original_content: "",
      original_platform: "linkedin",
      target_platforms: ["twitter", "instagram"],
      include_images: false,
    },
    Form: MayaVariantsForm,
    validate: (v) =>
      !v.original_content?.trim()
        ? "Original content is required."
        : v.target_platforms?.length === 0
          ? "Pick at least one target platform."
          : null,
  },
  "maya:revise": {
    defaultValue: {
      original_content: "",
      platform: "linkedin",
      feedback: "",
    },
    Form: MayaReviseForm,
    validate: (v) =>
      !v.original_content?.trim()
        ? "Original content is required."
        : !v.feedback?.trim()
          ? "Feedback is required."
          : null,
  },
  "maya:regenerate-image": {
    defaultValue: { image_url: "", prompt: "", platform: "instagram" },
    Form: MayaImageRegenForm,
    validate: (v) =>
      !v.image_url?.trim()
        ? "Image URL is required."
        : !v.prompt?.trim()
          ? "Prompt is required."
          : null,
  },
  "maya:regenerate-content": {
    defaultValue: { caption: "", prompt: "", platform: "instagram" },
    Form: MayaContentRegenForm,
    validate: (v) =>
      !v.caption?.trim()
        ? "Caption is required."
        : !v.prompt?.trim()
          ? "Prompt is required."
          : null,
  },

  "scout:research-topic": {
    defaultValue: { topic: "", depth: "standard", sources_hint: [] },
    Form: ScoutResearchTopicForm,
    validate: (v) => (v.topic?.trim() ? null : "Topic is required."),
  },
  "scout:research-company": {
    defaultValue: { company_name: "", company_url: "" },
    Form: ScoutResearchCompanyForm,
    validate: (v) => (v.company_name?.trim() ? null : "Company name is required."),
  },
  "scout:scan-competitors": {
    defaultValue: { competitors: [{ name: "", url: "" }] },
    Form: ScoutCompetitorScanForm,
    validate: (v) =>
      v.competitors?.some((c: { name: string; url: string }) => c.name && c.url)
        ? null
        : "Add at least one competitor with a name and URL.",
  },
  "scout:trending-topics": {
    defaultValue: { industry: "", count: 10 },
    Form: ScoutTrendingTopicsForm,
    validate: (v) => (v.industry?.trim() ? null : "Industry is required."),
  },

  "rex:analyze-metrics": {
    defaultValue: { metrics: {}, period: "monthly" },
    Form: RexAnalyzeMetricsForm,
    validate: (v) =>
      Object.keys(v.metrics ?? {}).length ? null : "Add at least one metric.",
  },
  "rex:forecast": {
    defaultValue: { metric_name: "", historical_data: [], horizon_days: 90 },
    Form: RexForecastForm,
    validate: (v) =>
      !v.metric_name?.trim()
        ? "Metric name is required."
        : (v.historical_data?.length ?? 0) < 3
          ? "Provide at least 3 historical data points."
          : null,
  },
  "rex:financial-analysis": {
    defaultValue: { revenue_data: [], expenses_data: [], subscribers_data: [] },
    Form: RexFinancialAnalysisForm,
    validate: (v) =>
      (v.revenue_data?.length ?? 0) < 2
        ? "Provide at least 2 revenue data points."
        : null,
  },
  "rex:compile-briefing": {
    defaultValue: { date: today(), all_metrics: {}, agent_summaries: {} },
    Form: RexBriefingForm,
    validate: (v) => (v.date ? null : "Date is required."),
  },

  "lex:ingest-document": {
    defaultValue: { document_name: "", document_type: "contract", pdf_base64: "" },
    Form: LexIngestDocumentForm,
    validate: (v) =>
      !v.document_name?.trim()
        ? "Document name is required."
        : !v.pdf_base64
          ? "Choose a PDF file."
          : null,
  },
  "lex:analyze-contract": {
    defaultValue: { contract_text: "", analysis_focus: [] },
    Form: LexAnalyzeContractForm,
    validate: (v) =>
      v.contract_text?.trim() ? null : "Contract text is required.",
  },
  "lex:draft-document": {
    defaultValue: {
      document_type: "",
      requirements: "",
      jurisdiction: "",
      additional_clauses: [],
    },
    Form: LexDraftDocumentForm,
    validate: (v) =>
      !v.document_type?.trim()
        ? "Document type is required."
        : !v.requirements?.trim()
          ? "Requirements are required."
          : null,
  },
  "lex:explain": {
    defaultValue: { text: "", context: "" },
    Form: LexExplainForm,
    validate: (v) => (v.text?.trim() ? null : "Legal text is required."),
  },
  "lex:legal-research": {
    defaultValue: { query: "", jurisdiction: "United States", legal_areas: [] },
    Form: LexLegalResearchForm,
    validate: (v) => (v.query?.trim() ? null : "Question is required."),
  },
  "lex:compliance-check": {
    defaultValue: { description: "", frameworks: [], business_context: "" },
    Form: LexComplianceCheckForm,
    validate: (v) =>
      !v.description?.trim()
        ? "Describe what you're checking."
        : !v.frameworks?.length
          ? "Add at least one framework."
          : null,
  },

  "vega:process-inbox": {
    defaultValue: { max_emails: 20, auto_label: true, draft_replies: false },
    Form: VegaProcessInboxForm,
  },
  "vega:draft-reply": {
    defaultValue: { email_id: "", reply_instructions: "", save_as_draft: true },
    Form: VegaDraftReplyForm,
    validate: (v) =>
      !v.email_id?.trim()
        ? "Email ID is required."
        : !v.reply_instructions?.trim()
          ? "Reply instructions are required."
          : null,
  },
  "vega:calendar-summary": {
    defaultValue: { days_ahead: 7 },
    Form: VegaCalendarSummaryForm,
  },
  "vega:create-event": {
    defaultValue: { description: "", check_conflicts: true },
    Form: VegaCreateEventForm,
    validate: (v) => (v.description?.trim() ? null : "Describe the event."),
  },
  "vega:executive-briefing": {
    defaultValue: { include_email: true, include_calendar: true },
    Form: VegaExecutiveBriefingForm,
  },
}

export interface RunActionDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  actionId: AgentActionId | null
  organizationId: string
  conversationId?: string
  onComplete: (ctx: ActionResultContext<unknown, unknown>) => void
}

export function RunActionDialog({
  open,
  onOpenChange,
  actionId,
  organizationId,
  conversationId,
  onComplete,
}: RunActionDialogProps) {
  if (!actionId) return null
  const meta = findAction(actionId)
  const spec = SPECS[actionId]
  if (!meta || !spec) return null

  const { Form, defaultValue, validate } = spec

  return (
    <ActionDialog<unknown, unknown>
      open={open}
      onOpenChange={onOpenChange}
      actionId={actionId}
      title={meta.label}
      description={meta.description}
      organizationId={organizationId}
      conversationId={conversationId}
      defaultValue={defaultValue}
      validate={validate}
      renderForm={({ value, onChange }) => (
        <Form value={value} onChange={onChange} />
      )}
      onComplete={onComplete}
    />
  )
}
