"use client"

import * as React from "react"
import type { AgentActionId } from "@/lib/types/agents"

// Sage
import {
  KeywordClusterCard,
  BlogPreviewCard,
  ContentAuditCard,
  ContentBriefCard,
  BlogIdeasCard,
} from "@/components/agents/sage/cards"
// Maya
import {
  IdeasGridCard,
  DraftCard,
  VariantsTabsCard,
  RevisionDiffCard,
  ImageRegenCard,
  ContentRegenCard,
} from "@/components/agents/maya/cards"
// Scout
import {
  ResearchReportCard,
  CompanyProfileCard,
  TrendsBoardCard,
  DiscoverCompetitorsCard,
} from "@/components/agents/scout/cards"
// Rex
import {
  MetricsAnalysisCard,
  ForecastCard,
  FinancialHealthCard,
  BriefingCard,
  RunwayCard,
  UnitEconomicsCard,
  ScenarioCard,
  WeeklyDigestCard,
  InvestorUpdateCard,
  VarianceCard,
  BoardDeckCard,
} from "@/components/agents/rex/cards"
// Lex
import {
  DocumentIngestCard,
  ContractAnalysisCard,
  QueryDocumentCard,
  DraftDocumentCard,
  ExplainerCard,
  LegalResearchCard,
  ComplianceCheckCard,
} from "@/components/agents/lex/cards"
// Vega
import {
  InboxTriageCard,
  DraftReplyCard,
  CalendarCard,
  EventCreatedCard,
  ExecutiveBriefingCard,
  ComposeEmailCard,
} from "@/components/agents/vega/cards"

export interface ActionResultRendererProps {
  actionId: AgentActionId
  result: unknown
  onFollowUpAction?: (actionId: AgentActionId, prefill?: Record<string, unknown>) => void
  onRevertImage?: () => void
}

/** Dispatches an action result to its matching card. Results are untyped at
 * the boundary (they come back from JSON); each card validates shape at runtime
 * by reading the fields it expects. */
export function ActionResultRenderer({ actionId, result, onFollowUpAction, onRevertImage }: ActionResultRendererProps) {
  // Use any-cast into typed cards - each card declares the precise type.
  const r = result as never

  switch (actionId) {
    case "sage:keyword-research":
      return <KeywordClusterCard result={r} />
    case "sage:generate-blog":
      return <BlogPreviewCard result={r} />
    case "sage:analyze-content":
      return <ContentAuditCard result={r} />
    case "sage:content-brief":
      return <ContentBriefCard result={r} />
    case "sage:generate-blog-ideas":
      return <BlogIdeasCard result={r} onFollowUpAction={onFollowUpAction} />

    case "maya:generate-ideas":
      return <IdeasGridCard result={r} onFollowUpAction={onFollowUpAction} />
    case "maya:draft-content":
      return <DraftCard result={r} onFollowUpAction={onFollowUpAction} onRevertImage={onRevertImage} />
    case "maya:generate-variants":
      return <VariantsTabsCard result={r} onFollowUpAction={onFollowUpAction} />
    case "maya:revise":
      return <RevisionDiffCard result={r} />
    case "maya:regenerate-image":
      return <ImageRegenCard result={r} />
    case "maya:regenerate-content":
      return <ContentRegenCard result={r} />

    case "scout:research-topic":
      return <ResearchReportCard result={r} />
    case "scout:research-company":
      return <CompanyProfileCard result={r} />
    case "scout:trending-topics":
      return <TrendsBoardCard result={r} />
    case "scout:discover-competitors":
      return <DiscoverCompetitorsCard result={r} />

    case "rex:analyze-metrics":
      return <MetricsAnalysisCard result={r} onFollowUpAction={onFollowUpAction} />
    case "rex:forecast":
      return <ForecastCard result={r} onFollowUpAction={onFollowUpAction} />
    case "rex:financial-analysis":
      return <FinancialHealthCard result={r} onFollowUpAction={onFollowUpAction} />
    case "rex:compile-briefing":
      return <BriefingCard result={r} onFollowUpAction={onFollowUpAction} />
    case "rex:runway":
      return <RunwayCard result={r} onFollowUpAction={onFollowUpAction} />
    case "rex:unit-economics":
      return <UnitEconomicsCard result={r} onFollowUpAction={onFollowUpAction} />
    case "rex:scenario":
      return <ScenarioCard result={r} onFollowUpAction={onFollowUpAction} />
    case "rex:weekly-digest":
      return <WeeklyDigestCard result={r} onFollowUpAction={onFollowUpAction} />
    case "rex:investor-update":
      return <InvestorUpdateCard result={r} onFollowUpAction={onFollowUpAction} />
    case "rex:variance":
      return <VarianceCard result={r} onFollowUpAction={onFollowUpAction} />
    case "rex:board-deck":
      return <BoardDeckCard result={r} onFollowUpAction={onFollowUpAction} />

    case "lex:upload-source":
      return <DocumentIngestCard result={r} />
    case "lex:analyze-contract":
      return <ContractAnalysisCard result={r} />
    case "lex:query-document":
      return <QueryDocumentCard result={r} />
    case "lex:draft-document":
      return <DraftDocumentCard result={r} />
    case "lex:explain":
      return <ExplainerCard result={r} />
    case "lex:legal-research":
      return <LegalResearchCard result={r} />
    case "lex:compliance-check":
      return <ComplianceCheckCard result={r} />

    case "vega:process-inbox":
      return <InboxTriageCard result={r} />
    case "vega:draft-reply":
      return <DraftReplyCard result={r} />
    case "vega:calendar-summary":
      return <CalendarCard result={r} />
    case "vega:create-event":
      return <EventCreatedCard result={r} />
    case "vega:executive-briefing":
      return <ExecutiveBriefingCard result={r} />
    case "vega:compose-email":
      return <ComposeEmailCard result={r} />

    default:
      return (
        <pre className="max-h-72 overflow-auto rounded border border-border bg-muted/20 p-2 text-[10px]">
          {JSON.stringify(result, null, 2)}
        </pre>
      )
  }
}
