"use client"

import type { AgentActionId } from "@/lib/types/agents"
import type { ContentPlanItem } from "@/lib/api/assistants"

import { MayaPublishedPostsTab } from "@/components/agents/maya/published-posts-tab"
import { MayaContentPlanTab } from "@/components/agents/maya/content-plan-tab"
import { MayaGalleryTab } from "@/components/agents/maya/gallery-tab"
import { useWorkspaceChat } from "../../WorkspaceChatProvider"

/**
 * Maya's existing tabs as Work lists, unchanged.
 *
 * The posts calendar already reads its own org and needs nothing from the
 * workspace, so it is passed straight through. The content plan needs one
 * thing: turning a planned slot into an actual draft, which in the workspace
 * means opening the matching action rather than switching a tab.
 */

export function MayaPostsWork() {
  return <MayaPublishedPostsTab />
}

export function MayaGalleryWork() {
  return <MayaGalleryTab />
}

export function MayaPlansWork() {
  const { openAction } = useWorkspaceChat()

  return (
    <MayaContentPlanTab
      onCreate={(item: ContentPlanItem) => {
        // Ported verbatim from the old chat page. The split is not arbitrary:
        // the video form is one free-text prompt, so the angle and the detail
        // have to be merged; the draft form has a single-line topic field,
        // where putting the caption direction too produced an unreadable
        // sentence. That belongs in "additional context".
        if (item.format === "reel") {
          openAction("maya:generate-video" as AgentActionId, {
            prompt: [item.hook, item.captionDirection].filter(Boolean).join(". "),
            platform: "instagram",
            aspect_ratio: "9:16",
            duration_seconds: 10,
            use_logo: false,
          })
        } else {
          openAction("maya:draft-content" as AgentActionId, {
            topic: item.hook,
            additional_context: item.captionDirection,
            platforms: ["instagram"],
            word_count_target: 200,
            include_image: true,
            use_logo: true,
            use_brand_colors: true,
          })
        }
      }}
    />
  )
}
