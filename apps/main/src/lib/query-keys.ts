export const qk = {
  brandKit: (organizationId: string) => ["brand-kit", organizationId] as const,
  integrations: () => ["integrations"] as const,
  mcpConnections: () => ["mcp", "connections"] as const,
  mcpConfigSchema: (slug: string) => ["mcp", "config-schema", slug] as const,
  mcpConnectionStatus: (slug: string) => ["mcp", "connection-status", slug] as const,
  mcpConnectionProof: (slug: string) => ["mcp", "connection-proof", slug] as const,
  mcpCommandCenter: () => ["mcp", "command-center"] as const,
  mcpValueReport: () => ["mcp", "value-report"] as const,
  mcpPendingAction: (id: string) => ["mcp", "pending-action", id] as const,
  mcpToolPreference: (agent: string) => ["mcp", "tool-preference", agent] as const,
  mcpTriggers: () => ["mcp", "triggers"] as const,
  mcpActionLog: (filters: string) => ["mcp", "action-log", filters] as const,
  mcpApprovalPolicies: () => ["mcp", "approval-policies"] as const,
  mcpPlays: () => ["mcp", "plays"] as const,
  assistantStatuses: (organizationId: string) =>
    ["assistant-statuses", organizationId] as const,
  lastMessages: (organizationId: string) =>
    ["last-messages", organizationId] as const,
  dashboardIntegrationHealth: (organizationId?: string) =>
    organizationId
      ? (["dashboard", "integration-health", organizationId] as const)
      : (["dashboard", "integration-health"] as const),
  rexDatasets: (organizationId: string) => ["rex", "datasets", organizationId] as const,
  chat: (agentSlug: string, organizationId: string) =>
    ["chat", agentSlug, organizationId] as const,
  lexSources: () => ["lex", "sources"] as const,
  lexSourceSearch: (q: string) => ["lex", "sources", "search", q] as const,
  lexSource: (id: string) => ["lex", "source", id] as const,
  lexWatch: () => ["lex", "watch"] as const,
  lexBrief: () => ["lex", "brief"] as const,
  lexPreferences: () => ["lex", "preferences"] as const,
  lexSettings: () => ["lex", "settings"] as const,
  lexVersionCandidates: (name: string) => ["lex", "version-candidates", name] as const,
  pinnedMessages: (agentSlug: string, organizationId: string) =>
    ["pinned-messages", agentSlug, organizationId] as const,
  mayaPublishedPosts: (organizationId: string) =>
    ["maya", "published-posts", organizationId] as const,
  mayaContentPlans: (organizationId: string) =>
    ["maya", "content-plans", organizationId] as const,
  mayaUsage: (organizationId: string) =>
    ["maya", "usage", organizationId] as const,
  mayaLogoAnimationStyles: () => ["maya", "logo-animation-styles"] as const,
  vegaInbox: (organizationId: string) => ["vega", "inbox", organizationId] as const,
  vegaThread: (organizationId: string, emailId: string) =>
    ["vega", "thread", organizationId, emailId] as const,
  vegaFollowUps: (organizationId: string) => ["vega", "follow-ups", organizationId] as const,
  vegaVIPContacts: (organizationId: string) => ["vega", "vip-contacts", organizationId] as const,
  vegaBriefing: (organizationId: string, type: string) =>
    ["vega", "briefing", organizationId, type] as const,
  vegaCalendar: (
    organizationId: string,
    range?: { timeMin: string; timeMax: string; timeZone?: string }
  ) =>
    range
      ? [
          "vega",
          "calendar",
          organizationId,
          range.timeMin,
          range.timeMax,
          range.timeZone ?? "",
        ] as const
      : (["vega", "calendar", organizationId] as const),
  vegaMeetingPrep: (eventId: string) =>
    ["vega", "meeting-prep", eventId] as const,
  vegaPostMeetingFollowup: (eventId: string, context = "") =>
    ["vega", "post-meeting-followup", eventId, context] as const,
  vegaRescheduleDraft: (eventId: string, newStart = "", newEnd = "") =>
    ["vega", "reschedule-draft", eventId, newStart, newEnd] as const,
  vegaLabels: (organizationId: string) =>
    ["vega", "labels", organizationId] as const,

  // Agent workspaces. Keyed by agent rather than org where the endpoint is
  // already org-scoped by the session, except the overview, which is cached
  // per org so switching organizations cannot show the previous one's numbers.
  workspaceOverview: (agent: string, organizationId: string) =>
    ["workspace", "overview", agent, organizationId] as const,
  workspaceWork: (agent: string, filters: string) =>
    ["workspace", "work", agent, filters] as const,
  workspaceActivity: (agent: string, filters: string) =>
    ["workspace", "activity", agent, filters] as const,
  workspaceInsights: (agent: string, status: string) =>
    ["workspace", "insights", agent, status] as const,
  workspaceApprovals: (agent: string) => ["workspace", "approvals", agent] as const,
  workspaceMemory: (agent: string) => ["workspace", "memory", agent] as const,
  mayaCampaigns: (status: string) => ["maya", "campaigns", status] as const,
  scoutProjects: () => ["scout", "projects"] as const,
  scoutProject: (id: string) => ["scout", "project", id] as const,
  companyPulse: (organizationId: string) => ["workspace", "pulse", organizationId] as const,
}
