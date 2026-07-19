"use client"

import { useEffect, useRef } from "react"
import { authClient } from "@/lib/auth-client"
import type { DriveStep } from "driver.js"
import "driver.js/dist/driver.css"

const STEPS: DriveStep[] = [
  {
    popover: {
      title: "Meet your AI crew",
      description:
        "Six specialists, each with a unique skillset and personality. They share your brand context and work independently — all you do is ask.",
      nextBtnText: "Introduce me →",
    },
  },
  {
    element: "[data-tour='assistants-sidebar']",
    popover: {
      title: "Your crew of six",
      description:
        "Every assistant lives here. Click any name to open a conversation — they remember your brand voice, past chats, and company context.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "[data-tour='assistant-row-vega']",
    popover: {
      title: "Vega — Chief of Staff",
      description:
        "Manages your inbox, schedules meetings, and delivers executive briefings every morning. Your always-on right hand.",
      side: "right",
      align: "center",
    },
  },
  {
    element: "[data-tour='assistant-row-maya']",
    popover: {
      title: "Maya — Content & Marketing",
      description:
        "Writes social posts, blogs, and ad copy in your brand voice — and generates on-brand images automatically.",
      side: "right",
      align: "center",
    },
  },
  {
    element: "[data-tour='assistant-row-rex']",
    popover: {
      title: "Rex — Finance & Data",
      description:
        "Tracks MRR, churn, and burn rate with RED/AMBER/GREEN health flags. Spots anomalies before they become surprises.",
      side: "right",
      align: "center",
    },
  },
  {
    element: "[data-tour='assistant-row-scout']",
    popover: {
      title: "Scout — Research",
      description:
        "Monitors competitors, surfaces market trends, and generates research memos. Hunting 24/7 so you don't have to.",
      side: "right",
      align: "center",
    },
  },
  {
    element: "[data-tour='assistant-row-sage']",
    popover: {
      title: "Sage — SEO Specialist",
      description:
        "Runs keyword research, audits your content, and writes full blog drafts optimised for search. Ranks pages in her sleep.",
      side: "right",
      align: "center",
    },
  },
  {
    element: "[data-tour='assistant-row-lex']",
    popover: {
      title: "Lex — Legal Assistant",
      description:
        "Reviews contracts, drafts NDAs, and explains legal clauses in plain English. Reads the fine print so you don't have to.",
      side: "right",
      align: "center",
    },
  },
  {
    element: "[data-tour='onboard-me-button']",
    popover: {
      title: "Connect their tools",
      description:
        "Your crew can only reach real data once you connect it — Gmail, Slack, Stripe, and 1000+ more. Click here anytime to onboard an agent.",
      side: "bottom",
      align: "center",
      nextBtnText: "Let's connect something",
    },
  },
]

export function AssistantsTour() {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const startedRef = useRef(false)

  useEffect(() => {
    const orgId = activeOrg?.id
    if (!orgId || startedRef.current) return

    // v2: appends the "Connect their tools" / onboard-me step.
    const key = `veqiro.assistants.tour.v2.${orgId}`
    if (localStorage.getItem(key) === "1") return

    startedRef.current = true
    localStorage.setItem(key, "1")

    const t = setTimeout(async () => {
      const { driver } = await import("driver.js")
      const d = driver({
        showProgress: true,
        steps: STEPS,
        animate: true,
        popoverClass: "vq-tour",
      })
      d.drive()
    }, 700)

    return () => clearTimeout(t)
  }, [activeOrg?.id])

  return null
}
