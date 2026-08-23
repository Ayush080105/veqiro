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
  lastMessages: () => ["last-messages"] as const,
  chat: (agentSlug: string, organizationId: string) =>
    ["chat", agentSlug, organizationId] as const,
  lexSources: () => ["lex", "sources"] as const,
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
}
