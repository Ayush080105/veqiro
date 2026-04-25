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

export interface AgentStat {
  k: string
  v: string
}

export interface AgentConfig {
  id: AgentSlug
  name: string
  role: string
  llm: string
  personality: string
  description: string
  specialties: string[]
  /** CSS colour token or literal (e.g. `var(--vq-red)` or `#F06464`). */
  color: string
  /** Darker ink variant used for borders, headings, accents on this agent's colour. */
  ink: string
  initials: string
  /** Short marketing tagline from the landing crew copy. */
  tag: string
  /** First-person quote from this agent, shown in chat empty-states and cards. */
  quote: string
  /** Vanity stats, shown on crew cards. */
  stats: AgentStat[]
  /** Canonical skill labels used on crew cards (shorter than `specialties`). */
  skills: string[]
  /** Quick-prompt suggestions shown on the chat empty-state. */
  quickPrompts: string[]
}

export interface AgentStatusData {
  status: AgentStatus
  lastActivity: string
}

export interface LastMessage {
  content: string
  createdAt: string
  role: "user" | "assistant"
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

// camelCase end-to-end on the client API. The server translates to snake_case
// for the Postgres table at the storage edge.
export interface BrandKit {
  companyName: string
  companyDescription: string
  industry: string
  targetAudience: string
  brandVoice: string
  logoUrl: string | null
  logoKey: string | null
  mascotUrl: string | null
  mascotKey: string | null
  brandColors: BrandColors
  platformTones: PlatformTones
  competitors: string[]
  keyDifferentiators: string
  websiteUrl: string
}

// ─── Brain Form Types ────────────────────────────────────────────────────────

export interface BrainFormValues {
  companyName: string
  companyDescription: string
  websiteUrl: string
  industry: string
  targetAudience: string
  brandVoice: string
  platformTones: { twitter: string; linkedin: string; instagram: string }
  brandColors: { primary: string; secondary: string; accent: string }
  competitors: Array<{ value: string }>
  keyDifferentiators: string
  logoUrl: string | null
  logoKey: string | null
  mascotUrl: string | null
  mascotKey: string | null
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
