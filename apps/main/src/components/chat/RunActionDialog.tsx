"use client"

import * as React from "react"
import { ActionDialog, type ActionResultContext } from "@/components/chat/ActionDialog"
import { findAction } from "@/lib/agents/actions"
import { runAgentAction } from "@/lib/api/assistants"
import { uploadToR2 } from "@/lib/api/uploads"
import type { AgentActionId } from "@/lib/types/agents"

// Sage forms
import {
  SageKeywordResearchForm,
  SageGenerateBlogForm,
  SageAnalyzeContentForm,
  SageContentBriefForm,
  SageGenerateBlogIdeasForm,
} from "@/components/agents/sage/forms"
// Maya forms
import {
  MayaIdeationForm,
  MayaDraftForm,
  MayaVariantsForm,
  MayaReviseForm,
  MayaImageRegenForm,
  MayaContentRegenForm,
  MayaCampaignForm,
} from "@/components/agents/maya/forms"
// Scout forms
import {
  ScoutResearchTopicForm,
  ScoutResearchCompanyForm,
  ScoutTrendingTopicsForm,
  ScoutDiscoverCompetitorsForm,
} from "@/components/agents/scout/forms"
// Rex forms
import {
  RexAnalyzeMetricsForm,
  RexForecastForm,
  RexFinancialAnalysisForm,
  RexBriefingForm,
  RexRunwayForm,
  RexUnitEconomicsForm,
  RexScenarioForm,
  RexWeeklyDigestForm,
  RexInvestorUpdateForm,
  RexVarianceForm,
  RexBoardDeckForm,
} from "@/components/agents/rex/forms"
// Lex forms
import {
  LexUploadSourceForm,
  LexAnalyzeContractForm,
  LexQueryDocumentForm,
  LexDraftDocumentForm,
  LexExplainForm,
  LexLegalResearchForm,
  LexComplianceCheckForm,
} from "@/components/agents/lex/forms"
import { uploadLexDocument } from "@/lib/api/lex"
// Vega forms
import {
  VegaProcessInboxForm,
  VegaDraftReplyForm,
  VegaCalendarSummaryForm,
  VegaCreateEventForm,
  VegaExecutiveBriefingForm,
  VegaComposeEmailForm,
} from "@/components/agents/vega/forms"

/* eslint-disable @typescript-eslint/no-explicit-any -- heterogeneous form dispatch across agent actions */
type FormComponent = React.ComponentType<{
  value: any
  onChange: (patch: any) => void
}>

interface ActionSpec {
  defaultValue: unknown
  Form: FormComponent
  validate?: (v: any) => string | null
  /** Override the default JSON `runAgentAction` submit, e.g. for file uploads. */
  customSubmit?: (value: any, organizationId: string) => Promise<unknown>
  /** Dynamically resolve action ID from current form value (e.g. carousel routing). */
  resolveActionId?: (v: any) => AgentActionId
}
/* eslint-enable @typescript-eslint/no-explicit-any */

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
  "sage:generate-blog-ideas": {
    defaultValue: { count: 5 },
    Form: SageGenerateBlogIdeasForm,
  },

  "maya:campaign": {
    defaultValue: {
      product_image: null,
      campaign_brief: "",
      photo_count: 4,
      use_brand_kit: true,
      platform: "instagram",
    },
    Form: MayaCampaignForm,
    validate: (v) =>
      !v.product_image
        ? "Upload a product image."
        : !v.campaign_brief?.trim()
          ? "Campaign brief is required."
          : null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    customSubmit: async (v: any, organizationId: string) => {
      const uploaded = await uploadToR2("inspiration", v.product_image as File)
      if (!uploaded.ok) throw new Error(uploaded.message ?? "Image upload failed")
      return runAgentAction("maya:campaign", organizationId, {
        product_image_url: uploaded.publicUrl,
        campaign_brief: v.campaign_brief,
        photo_count: v.photo_count,
        use_brand_kit: v.use_brand_kit,
        platform: v.platform,
      })
    },
  },
  "maya:generate-ideas": {
    defaultValue: { platform: "linkedin", count: 5, topic_hint: "", use_brandkit: false },
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
      make_carousel: false,
      carousel_count: 3,
    },
    Form: MayaDraftForm,
    validate: (v) => (v.topic?.trim() ? null : "Topic is required."),
    resolveActionId: (v) => (v.make_carousel ? "maya:draft-carousel" : "maya:draft-content"),
  },
  "maya:draft-carousel": {
    defaultValue: {
      topic: "",
      platform: "linkedin",
      include_image: true,
      use_logo: false,
      use_mascot: false,
      make_carousel: true,
      carousel_count: 3,
    },
    Form: MayaDraftForm,
    validate: (v) => (v.topic?.trim() ? null : "Topic is required."),
    resolveActionId: () => "maya:draft-carousel",
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
    defaultValue: { image_url: "", prompt: "", platform: "instagram", use_logo: false, use_mascot: false },
    Form: MayaImageRegenForm,
    validate: (v) => (!v.prompt?.trim() ? "Prompt is required." : null),
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
  "scout:trending-topics": {
    defaultValue: { industry: "", count: 10 },
    Form: ScoutTrendingTopicsForm,
    validate: (v) => (v.industry?.trim() ? null : "Industry is required."),
  },
  "scout:discover-competitors": {
    defaultValue: { description: "", industry: "", count: 8 },
    Form: ScoutDiscoverCompetitorsForm,
    validate: (v) =>
      !v.description?.trim()
        ? "Product description is missing — fill in your Brain first."
        : null,
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
  "rex:runway": {
    defaultValue: { cash_on_hand: 0, monthly_burn: 0, monthly_revenue: 0, growth_rate_pct: 0 },
    Form: RexRunwayForm,
    validate: (v) =>
      !v.cash_on_hand || v.cash_on_hand <= 0
        ? "Cash on hand must be a positive number."
        : !v.monthly_burn || v.monthly_burn <= 0
          ? "Monthly burn must be a positive number."
          : null,
  },
  "rex:unit-economics": {
    defaultValue: {
      marketing_spend: [],
      new_customers: [],
      avg_monthly_revenue_per_customer: 0,
      avg_customer_lifetime_months: 24,
    },
    Form: RexUnitEconomicsForm,
    validate: (v) =>
      !v.marketing_spend?.length
        ? "Add at least one marketing spend data point."
        : !v.new_customers?.length
          ? "Add at least one new customers data point."
          : !v.avg_monthly_revenue_per_customer || v.avg_monthly_revenue_per_customer <= 0
            ? "Avg monthly revenue per customer is required."
            : null,
  },
  "rex:scenario": {
    defaultValue: {
      base_metrics: { mrr: 0, burn: 0, cash: 0, growth_rate: 0 },
      scenarios: [{ name: "", changes: {} }],
    },
    Form: RexScenarioForm,
    validate: (v) =>
      !v.scenarios?.length
        ? "Add at least one scenario."
        : v.scenarios.some((s: { name: string }) => !s.name?.trim())
          ? "All scenarios need a name."
          : null,
  },
  "rex:weekly-digest": {
    defaultValue: { metrics: {}, prev_week: {} },
    Form: RexWeeklyDigestForm,
    validate: (v) =>
      !Object.keys(v.metrics ?? {}).length ? "Add at least one metric." : null,
  },
  "rex:investor-update": {
    defaultValue: { period: "", metrics: {}, highlights: [], asks: [] },
    Form: RexInvestorUpdateForm,
    validate: (v) => (v.period?.trim() ? null : "Period is required."),
  },
  "rex:variance": {
    defaultValue: { metric: "", period: "monthly" },
    Form: RexVarianceForm,
    validate: (v) => (v.metric?.trim() ? null : "Pick a metric."),
  },
  "rex:board-deck": {
    defaultValue: { period: "", metrics: {}, highlights: [], risks: [], ask: "" },
    Form: RexBoardDeckForm,
    validate: (v) => (v.period?.trim() ? null : "Period is required."),
  },

  "lex:upload-source": {
    defaultValue: { file: null, document_name: "", document_type: "contract" },
    Form: LexUploadSourceForm,
    validate: (v) =>
      !v.file
        ? "Choose a PDF file."
        : !v.document_name?.trim()
          ? "Document name is required."
          : null,
    customSubmit: async (v) =>
      uploadLexDocument({
        file: v.file as File,
        documentName: v.document_name,
        documentType: v.document_type ?? "contract",
      }),
  },
  "lex:analyze-contract": {
    defaultValue: { source_id: "", contract_text: "", analysis_focus: [] },
    Form: LexAnalyzeContractForm,
    validate: (v) =>
      v.source_id?.trim() || v.contract_text?.trim()
        ? null
        : "Pick a document or paste contract text.",
  },
  "lex:query-document": {
    defaultValue: { sourceId: "", query: "" },
    Form: LexQueryDocumentForm,
    validate: (v) =>
      !v.sourceId?.trim()
        ? "Pick a document."
        : !v.query?.trim()
          ? "Enter a question."
          : null,
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
  "vega:compose-email": {
    defaultValue: {
      to: "",
      subject: "",
      instructions: "",
      tone: "professional",
      include_cta: true,
    },
    Form: VegaComposeEmailForm,
    validate: (v) =>
      !v.to?.trim()
        ? "Recipient email is required."
        : !v.subject?.trim()
          ? "Subject is required."
          : !v.instructions?.trim()
            ? "Instructions are required."
            : null,
  },
}

export interface RunActionDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  actionId: AgentActionId | null
  organizationId: string
  conversationId?: string
  /** Optional partial that's shallow-merged over the spec's defaultValue. */
  prefill?: Record<string, unknown>
  onComplete: (ctx: ActionResultContext<unknown, unknown>) => void
}

export function RunActionDialog({
  open,
  onOpenChange,
  actionId,
  organizationId,
  conversationId,
  prefill,
  onComplete,
}: RunActionDialogProps) {
  if (!actionId) return null
  const meta = findAction(actionId)
  const spec = SPECS[actionId]
  if (!meta || !spec) return null

  const { Form, defaultValue, validate, customSubmit, resolveActionId } = spec
  const merged = {
    ...(prefill ? { ...(defaultValue as object), ...prefill } : defaultValue),
    organization_id: organizationId,
  }

  return (
    <ActionDialog<unknown, unknown>
      open={open}
      onOpenChange={onOpenChange}
      actionId={actionId}
      title={meta.label}
      description={meta.description}
      organizationId={organizationId}
      conversationId={conversationId}
      defaultValue={merged}
      validate={validate}
      customSubmit={customSubmit}
      resolveActionId={resolveActionId}
      renderForm={({ value, onChange }) => (
        <Form value={value} onChange={onChange} />
      )}
      onComplete={onComplete}
    />
  )
}
