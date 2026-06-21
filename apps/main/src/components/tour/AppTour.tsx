"use client"

import { useEffect, useRef } from "react"
import { authClient } from "@/lib/auth-client"
import type { DriveStep } from "driver.js"
import "driver.js/dist/driver.css"

const STEPS: DriveStep[] = [
  {
    popover: {
      title: "Welcome to Veqiro",
      description:
        "You've set up your workspace. Let us walk you through what each section does — it only takes a minute.",
      nextBtnText: "Show me around →",
    },
  },
  {
    element: "[data-tour='nav-dashboard']",
    popover: {
      title: "Dashboard",
      description:
        "Your command center. See agent activity, key metrics, and a one-click link to today's briefing.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "[data-tour='dashboard-briefing']",
    popover: {
      title: "Today's Briefing",
      description:
        "Vega reads your inbox and calendar each morning and produces a curated summary. Click to open your AI-organized day.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "[data-tour='dashboard-metrics']",
    popover: {
      title: "At a Glance",
      description:
        "Messages handled, posts published, and estimated hours saved — updated every time your crew takes action.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "[data-tour='nav-assistants']",
    popover: {
      title: "Assistants",
      description:
        "Your AI crew: Rex (Finance), Vega (Chief of Staff), Maya (Content), Sage (SEO), Lex (Legal), Scout (Research). Chat with any of them directly.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "[data-tour='nav-tasks']",
    popover: {
      title: "Tasks",
      description:
        "Schedule recurring operations — morning briefings, weekly SEO reports, daily content ideas — on any cadence you choose.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "[data-tour='nav-workspace']",
    popover: {
      title: "Workspace",
      description:
        "Your AI-powered Inbox, Briefing, and Calendar. Vega auto-labels emails, surfaces important threads, and syncs your schedule.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "[data-tour='nav-brain']",
    popover: {
      title: "Brain",
      description:
        "Your company knowledge base. Brand voice, products, competitors — everything here is fed to your agents so they always answer in context.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "[data-tour='nav-settings']",
    popover: {
      title: "Settings",
      description:
        "Connect Google, invite team members, configure billing, and adjust your brand profile.",
      side: "right",
      align: "start",
      nextBtnText: "Let's go →",
    },
  },
]

export function AppTour() {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const startedRef = useRef(false)

  useEffect(() => {
    const orgId = activeOrg?.id
    if (!orgId || startedRef.current) return

    if (localStorage.getItem("veqiro.tour.pending") !== "1") return

    const key = `veqiro.tour.v1.${orgId}`
    if (localStorage.getItem(key) === "1") return

    startedRef.current = true
    localStorage.removeItem("veqiro.tour.pending")
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
    }, 900)

    return () => clearTimeout(t)
  }, [activeOrg?.id])

  return null
}
