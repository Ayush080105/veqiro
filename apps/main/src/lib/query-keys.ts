export const qk = {
  brandKit: (organizationId: string) => ["brand-kit", organizationId] as const,
  integrations: () => ["integrations"] as const,
  assistantStatuses: (organizationId: string) =>
    ["assistant-statuses", organizationId] as const,
  lastMessages: () => ["last-messages"] as const,
  chat: (agentSlug: string, organizationId: string) =>
    ["chat", agentSlug, organizationId] as const,
  googleConnected: () => ["auth-accounts", "google"] as const,
  lexSources: () => ["lex", "sources"] as const,
  mayaPublishedPosts: (organizationId: string) =>
    ["maya", "published-posts", organizationId] as const,
}
