// ─── Message & Agent Types ────────────────────────────────────────────────────

export type AgentSlug = "maya" | "rex" | "scout" | "sage" | "lex" | "vega"

export type AgentStatus = "working" | "idle" | "needs-attention"

export interface Message {
  id?: string
  organizationId?: string
  role: "user" | "assistant"
  content: string
  imageUrl: string | null
  createdAt: string
  agent?: string
  tokensUsed?: number
  model?: string | null
  /** Rich structured action result. When set, the chat renders the matching result card. */
  customInput?: {
    actionId?: string
    input?: unknown
    result?: unknown
  } | null
}

export interface AgentConfig {
  id: AgentSlug
  name: string
  role: string
  llm: string
  personality: string
  description: string
  specialties: string[]
  color: string
  initials: string
}

export interface AgentStatusData {
  status: AgentStatus
  lastActivity: string
}

// ─── Brain / Brand Kit Types ──────────────────────────────────────────────────

export interface BrandColors {
  primary: string
  secondary: string
  accent: string
}

export interface PlatformTones {
  twitter: string
  linkedin: string
  instagram: string
}

export interface BrandKit {
  company_name: string
  company_description: string
  industry: string
  target_audience: string
  brand_voice: string
  logo_url: string | null
  mascot_url: string | null
  brand_colors: BrandColors
  platform_tones: PlatformTones
  competitors: string[]
  key_differentiators: string
  website_url: string
}

// ─── Knowledge / Brain Types ─────────────────────────────────────────────────

export type KnowledgeType = "document" | "webpage" | "note" | "image"

export interface KnowledgeItem {
  id: string
  type: KnowledgeType
  title: string
  content: string
  fileName?: string
  fileSize?: number
  agentAccess: AgentSlug[]
  createdAt: string
  updatedAt: string
}

// ─── Brain Form Types ────────────────────────────────────────────────────────

export interface BrainFormValues {
  company_name: string
  company_description: string
  website_url: string
  industry: string
  target_audience: string
  brand_voice: string
  platform_tones: { twitter: string; linkedin: string; instagram: string }
  brand_colors: { primary: string; secondary: string; accent: string }
  competitors: Array<{ value: string }>
  key_differentiators: string
}

// ─── Org Types ────────────────────────────────────────────────────────────────

export type OrgRole = "owner" | "admin" | "member"

export interface OrgMember {
  id: string
  email: string
  name: string
  role: OrgRole
  image?: string | null
}

export interface OrgInvite {
  email: string
  role: OrgRole
}

// ─── Content Types ────────────────────────────────────────────────────────────

export type ContentPlatform = "linkedin" | "twitter" | "instagram"
export type ContentStatus = "draft" | "scheduled" | "published"

export interface ContentItem {
  id: string
  platform: ContentPlatform
  headline: string
  content: string
  status: ContentStatus
  scheduledAt?: string | null
  imageUrl?: string | null
  createdAt: string
}

// ─── Lead Types ───────────────────────────────────────────────────────────────

export type LeadStatus = "new" | "contacted" | "qualified" | "closed"

export interface Lead {
  id: string
  company: string
  contact: string
  email?: string
  icpScore: number
  source: string
  status: LeadStatus
  createdAt: string
}

export interface Competitor {
  id: string
  name: string
  website: string
  lastUpdated: string
  summary?: string
}

// ─── Dashboard Types ──────────────────────────────────────────────────────────

export interface MetricCard {
  label: string
  value: string
  change?: string
  trend?: "up" | "down" | "neutral"
}

export interface ActivityItem {
  id: string
  agent: AgentSlug
  action: string
  timestamp: string
}

export interface DashboardSummary {
  briefingSummary: string
  assistantStatuses: Record<AgentSlug, AgentStatusData>
  recentActivity: ActivityItem[]
  metrics: MetricCard[]
}

// ─── Integration Types ────────────────────────────────────────────────────────

export interface Integration {
  name: string
  connected: boolean
  connectedAt?: string
}

// ─── Notification Types ───────────────────────────────────────────────────────

export type NotificationFrequency = "daily" | "twice-daily" | "weekly"

export interface NotificationSettings {
  deliveryTime: string
  channels: {
    inApp: boolean
    email: boolean
    push: boolean
  }
  frequency: NotificationFrequency
}
