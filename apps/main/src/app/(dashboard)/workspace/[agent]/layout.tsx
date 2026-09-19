"use client"

import { notFound, useParams } from "next/navigation"

import { authClient } from "@/lib/auth-client"
import { getAgent } from "@/lib/config/agents"
import { getWorkspaceSpec } from "@/lib/workspace/registry"
import { MediaViewerProvider } from "@/components/chat/MediaViewer"
import { AgentWorkspaceProvider } from "@/components/workspace/AgentWorkspaceContext"
import { WorkspaceChatProvider } from "@/components/workspace/WorkspaceChatProvider"
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell"
import { WorkspaceDialogs } from "@/components/workspace/WorkspaceDialogs"

/**
 * The agent workspace layout — and the reason the chat dock keeps its state.
 *
 * The App Router preserves a layout's React instance while the layout's own
 * dynamic segments are unchanged. `[agent]` is a segment of THIS layout, so
 * navigating lex → maya remounts everything (correct: a different
 * conversation), while overview → work → actions → approvals does not. The
 * chat hooks therefore live here, and a half-typed message, the scroll
 * position and an in-flight stream all survive module navigation for free.
 *
 * DO NOT, in this folder:
 *   - move these providers into a page.tsx,
 *   - add a loading.tsx at THIS level (per-module loading.tsx is fine; a
 *     Suspense boundary here re-suspends the dock along with the body),
 *   - add a template.tsx anywhere under workspace/ (templates remount),
 *   - introduce a changing `key` above this component.
 * Each of those silently throws away the customer's draft on every click.
 * WorkspaceChatProvider warns in dev if it detects a second mount.
 */
export default function AgentWorkspaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams<{ agent: string }>()
  const { data: activeOrg } = authClient.useActiveOrganization()

  const agentSlug = params.agent
  const config = getAgent(agentSlug)
  const spec = getWorkspaceSpec(agentSlug)

  if (!config || !spec) notFound()

  // Everything below is org-scoped, and rendering it against an empty org id
  // would fire a wave of requests that all 401. Waiting is the honest option.
  const organizationId = activeOrg?.id ?? ""

  return (
    <AgentWorkspaceProvider
      agent={spec.agent}
      config={config}
      spec={spec}
      organizationId={organizationId}
    >
      <MediaViewerProvider>
        <WorkspaceChatProvider>
          <WorkspaceShell>{children}</WorkspaceShell>
          <WorkspaceDialogs />
        </WorkspaceChatProvider>
      </MediaViewerProvider>
    </AgentWorkspaceProvider>
  )
}
