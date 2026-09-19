import type { ComponentType, LazyExoticComponent } from "react"
import type { AgentActionId } from "@/lib/types/agents"
import type { AgentSlug, Message } from "@/lib/types"

/**
 * The workspace framework's shape.
 *
 * THE RULE THAT KEEPS THIS HONEST: no file under lib/workspace/ outside
 * agents/ may contain an agent slug literal. The moment registry.ts says
 * `if (agent === "maya")`, this has become the old isMaya branching with a
 * layer of indirection on top — worse than what it replaced, not better.
 * Agent-specific behaviour belongs in that agent's spec or its own lazy
 * component. A field here has to earn its place by having two consumers.
 */

/** The ten surfaces from the PRD's common workspace framework. */
export type ModuleId =
  | "overview"
  | "work"
  | "actions"
  | "automations"
  | "memory"
  | "integrations"
  | "activity"
  | "approvals"
  | "chat"
  | "settings"

export type Lazy<P> = LazyExoticComponent<ComponentType<P>>

/** Props every module component receives. */
export interface ModuleProps {
  agent: AgentSlug
  organizationId: string
}

/** Props a work-type list receives. */
export interface WorkListProps extends ModuleProps {
  /** Set when a detail route is open beneath this list. */
  openObjectId?: string
}

export interface WorkDetailProps extends ModuleProps {
  objectId: string
}

/** Overview widgets receive exactly the module props; named for readability. */
export type OverviewWidgetProps = ModuleProps

export interface WorkTypeSpec {
  /** URL segment: /workspace/lex/work/<slug>. */
  slug: string
  label: string
  labelSingular: string
  /** WorkObjectIndex.kind, e.g. "lex.contract". */
  kind: string
  /** The existing per-agent tab component, reused as-is. */
  List: Lazy<WorkListProps>
  /** The existing detail/review component, when the type has one. */
  Detail?: Lazy<WorkDetailProps>
  /** Primary create CTAs, resolved through lib/agents/actions.ts. */
  createActions?: AgentActionId[]
}

export interface ModuleSpec {
  id: ModuleId
  /** Overrides the canonical label from modules.ts. */
  label?: string
  /**
   * "coming-soon" still resolves its route and renders an honest placeholder.
   * A module that 404s reads as a broken link; one that says "not yet" reads
   * as a roadmap.
   */
  status?: "ready" | "coming-soon"
  /** Hidden from the nav but still routable — chat on desktop, where the dock serves it. */
  hiddenInNav?: boolean
  /** Collapsed under "More", so ten modules don't present as ten equal peers. */
  demoted?: boolean
  /** Omit to use the framework default from default-modules.ts. */
  Component?: Lazy<ModuleProps>
}

export interface OverviewSpec {
  /**
   * Widgets are rendered in order. The first one should be the thing that
   * already works for this agent, so the workspace never feels like a
   * downgrade from the chat page on day one.
   */
  widgets: { id: string; span: "full" | "half"; Component: Lazy<OverviewWidgetProps> }[]
  quickActions?: AgentActionId[]
}

export interface AgentWorkspaceSpec {
  agent: AgentSlug
  /** Sparse overrides; the canonical order in modules.ts fills in the rest. */
  modules?: ModuleSpec[]
  workTypes: WorkTypeSpec[]
  overview: OverviewSpec
  /** Rendered in the workspace header — Maya's credits pill and top-up button. */
  headerExtras?: Lazy<ModuleProps>[]
  /** Rendered in the chat dock header — Scout's research-source toggle. */
  chatHeaderExtras?: Lazy<Record<string, never>>[]
  /** Agent-specific message post-processing, e.g. Maya's regen/variant merge. */
  transformMessages?: (messages: Message[]) => Message[]
  /** Composer capabilities, replacing the `isLex ? ...` props on ChatInput. */
  composer?: {
    attachments?: "lex-sources"
  }
}
