import {
  Activity,
  CheckSquare,
  FolderOpen,
  LayoutDashboard,
  MessageSquare,
  Plug,
  Repeat,
  Settings,
  Sparkles,
  Zap,
  type LucideIcon,
} from "lucide-react"

import type { ModuleId } from "./types"

/**
 * The canonical module order, labels and icons.
 *
 * Order matters and is not alphabetical: it follows the PRD's dashboard
 * hierarchy — outcome first, then chat (the always-available way to ask), then
 * the work, then what needs a human, and only then the configuration surfaces. An agent's spec can override a label or
 * demote a module, but it cannot reorder them, because every workspace looking
 * the same is the point.
 */
export const MODULE_ORDER: ModuleId[] = [
  "overview",
  "chat",
  "work",
  "actions",
  "approvals",
  "automations",
  "activity",
  "memory",
  "integrations",
  "settings",
]

export interface ModuleMeta {
  label: string
  icon: LucideIcon
  /** Short line shown in empty states and the "More" group. */
  blurb: string
}

export const MODULE_META: Record<ModuleId, ModuleMeta> = {
  overview: {
    label: "Overview",
    icon: LayoutDashboard,
    blurb: "Status, what needs you, and what just happened.",
  },
  work: {
    label: "Work",
    icon: FolderOpen,
    blurb: "The documents, campaigns and records this employee owns.",
  },
  actions: {
    label: "Actions",
    icon: Sparkles,
    blurb: "Everything you can ask this employee to do right now.",
  },
  approvals: {
    label: "Approvals",
    icon: CheckSquare,
    blurb: "Changes waiting for your decision before they run.",
  },
  automations: {
    label: "Automations",
    icon: Repeat,
    blurb: "Recurring and event-driven work that runs without you.",
  },
  activity: {
    label: "Activity",
    icon: Activity,
    blurb: "A record of what was found, done and decided.",
  },
  memory: {
    label: "Memory",
    icon: Zap,
    blurb: "The context and preferences this employee works from.",
  },
  integrations: {
    label: "Integrations",
    icon: Plug,
    blurb: "Connected systems and what this employee may do with them.",
  },
  settings: {
    label: "Settings",
    icon: Settings,
    blurb: "Role, policies and notifications.",
  },
  chat: {
    label: "Chat",
    icon: MessageSquare,
    blurb: "Talk to this employee directly.",
  },
}

export const ALL_MODULE_IDS = Object.keys(MODULE_META) as ModuleId[]
