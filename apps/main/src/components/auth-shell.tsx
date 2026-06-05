"use client"

import Link from "next/link"
import { useEffect, useState, type ReactNode } from "react"

import LoginBg from "@/components/login-bg"
import { AGENT_PROOFS } from "@/lib/agent-proofs"
import { cn } from "@/lib/utils"

type ShowcaseSide = "left" | "right" | "none"

interface AuthShellProps {
  children: ReactNode
  showcaseSide?: ShowcaseSide
  mobileAgents?: boolean
  className?: string
}

function BrandLogo() {
  return (
    <Link
      href="/"
      className="flex shrink-0 items-center gap-3 text-foreground no-underline"
    >
      <span className="grid size-[50px] shrink-0 rotate-[-6deg] place-items-center rounded-[12px] bg-foreground shadow-[4px_4px_0_var(--vq-yellow)]">
        <span className="font-display text-[28px] leading-none text-background">
          v
        </span>
      </span>
      <span className="font-display text-4xl leading-none tracking-normal text-foreground">
        veqiro
      </span>
    </Link>
  )
}

function MobileAgentChips() {
  return (
    <div className="z-10 mx-auto grid w-full max-w-md grid-cols-3 gap-2 lg:hidden">
      {AGENT_PROOFS.slice(0, 3).map((agent) => (
        <div
          key={agent.name}
          className="border-[3px] border-foreground bg-card px-3 py-2 shadow-[3px_3px_0_var(--foreground)]"
        >
          <div className="font-head text-sm uppercase tracking-normal">
            {agent.name}
          </div>
          <div className="mt-1 truncate font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {agent.shortTime}
          </div>
        </div>
      ))}
    </div>
  )
}

function FormPane({
  children,
  mobileAgents,
  entering,
}: {
  children: ReactNode
  mobileAgents: boolean
  entering: boolean
}) {
  return (
    <div
      data-auth-pane="form"
      data-auth-enter={entering ? "login" : undefined}
      className="relative flex min-h-screen flex-col gap-5 overflow-hidden px-6 py-6 md:px-10 md:py-8"
    >
      <div className="z-10 flex items-center justify-center gap-3 md:justify-start">
        <BrandLogo />
      </div>

      <div className="z-10 flex flex-1 items-center justify-center py-4">
        {children}
      </div>

      {mobileAgents && <MobileAgentChips />}
    </div>
  )
}

function ShowcasePane({ side }: { side: Exclude<ShowcaseSide, "none"> }) {
  return (
    <div
      className={cn(
        "hidden h-full items-stretch overflow-hidden border-foreground lg:flex",
        side === "left" ? "lg:border-r-[3px]" : "lg:border-l-[3px]"
      )}
    >
      <LoginBg />
    </div>
  )
}

export function AuthShell({
  children,
  showcaseSide = "right",
  mobileAgents = true,
  className,
}: AuthShellProps) {
  const [entering, setEntering] = useState(() => {
    if (typeof window === "undefined") return false
    return window.sessionStorage.getItem("auth-transition") === "signup-to-login"
  })

  useEffect(() => {
    if (!entering) {
      return
    }

    window.sessionStorage.removeItem("auth-transition")
    const id = window.setTimeout(() => setEntering(false), 420)
    return () => window.clearTimeout(id)
  }, [entering])

  if (showcaseSide === "none") {
    return (
      <div
        className={cn(
          "min-h-screen bg-background lg:grid lg:grid-cols-[minmax(520px,45vw)_1fr]",
          className
        )}
      >
        <FormPane mobileAgents={mobileAgents} entering={entering}>
          {children}
        </FormPane>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "min-h-screen bg-background lg:grid",
        showcaseSide === "left"
          ? "lg:grid-cols-[1fr_minmax(520px,45vw)]"
          : "lg:grid-cols-[minmax(520px,45vw)_1fr]",
        className
      )}
    >
      {showcaseSide === "left" && <ShowcasePane side="left" />}
      <FormPane mobileAgents={mobileAgents} entering={entering}>
        {children}
      </FormPane>
      {showcaseSide === "right" && <ShowcasePane side="right" />}
    </div>
  )
}
