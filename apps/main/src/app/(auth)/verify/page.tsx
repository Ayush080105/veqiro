"use client"

import { Suspense, useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCircle2, Loader2, Mail, XCircle } from "lucide-react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { AuthShell } from "@/components/auth-shell"
import { AuthCard } from "@/components/ui/auth-card"
import { Button } from "@/components/ui/button"
import Logo from "@/components/logo"
import { cn } from "@/lib/utils"

type VerifyState = "check-inbox" | "verifying" | "success" | "error"

interface IconTileProps {
  tone: "yellow" | "red" | "green" | "blue"
  children: ReactNode
}

const TONE_BG = {
  yellow: "bg-[color-mix(in_srgb,var(--vq-yellow)_18%,var(--card))]",
  red: "bg-destructive/12",
  green: "bg-[color:var(--vq-green)]/14",
  blue: "bg-[color:var(--vq-blue)]/14",
} as const

function IconTile({ tone, children }: IconTileProps) {
  return (
    <span
      className={cn(
        "grid size-[72px] place-items-center rounded-2xl border border-[var(--vq-line-2)] shadow-[var(--vq-shadow-sm)] [&_svg]:size-9 [&_svg]:text-foreground",
        TONE_BG[tone]
      )}
    >
      {children}
    </span>
  )
}

function StateCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-4 min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <Link href="/" className="flex items-center gap-3 text-foreground">
            <Logo className="size-10 shrink-0" />
            <span className="font-display text-3xl leading-none tracking-normal">
              veqiro
            </span>
          </Link>
      <AuthCard  className="text-center">
        {children}
      </AuthCard>
    </div>
  )
}

function VerifyContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token")
  const errorParam = searchParams.get("error")

  const [state, setState] = useState<VerifyState>(() =>
    token ? "verifying" : errorParam ? "error" : "check-inbox"
  )
  const [errorMessage, setErrorMessage] = useState<string>(
    errorParam ? decodeURIComponent(errorParam.replace(/_/g, " ")) : ""
  )

  useEffect(() => {
    if (!token) return
    let cancelled = false

    ;(async () => {
      try {
        const res = await authClient.verifyEmail({ query: { token } })
        if (cancelled) return
        if (res.error) {
          setErrorMessage(res.error.message || "Verification failed")
          setState("error")
          return
        }
        setState("success")
        toast.success("Email verified")
        setTimeout(() => {
          if (!cancelled) router.replace("/")
        }, 900)
      } catch (err) {
        if (cancelled) return
        setErrorMessage(
          err instanceof Error ? err.message : "Verification failed"
        )
        setState("error")
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token, router])

  if (state === "verifying") {
    return (
      <StateCard>
        <div className="flex flex-col items-center gap-5">
          <IconTile tone="blue">
            <Loader2 className="animate-spin" />
          </IconTile>
          <h1 className="m-0 font-display text-4xl leading-none tracking-tight text-foreground">
            verifying...
          </h1>
          <p className="m-0 font-body text-base text-foreground/80">
            Hang tight. We are confirming your email.
          </p>
        </div>
      </StateCard>
    )
  }

  if (state === "success") {
    return (
      <StateCard>
        <div className="flex flex-col items-center gap-5">
          <IconTile tone="green">
            <CheckCircle2 />
          </IconTile>
          <h1 className="m-0 font-display text-4xl leading-none tracking-tight text-foreground">
            you&apos;re in
          </h1>
          <p className="m-0 font-body text-base text-foreground/80">
            Redirecting you to onboarding...
          </p>
        </div>
      </StateCard>
    )
  }

  if (state === "error") {
    return (
      <StateCard>
        <div className="flex flex-col items-center gap-4">
          <IconTile tone="red">
            <XCircle />
          </IconTile>
          <h1 className="m-0 font-display text-4xl leading-none tracking-tight text-foreground">
            verification failed
          </h1>
          <p className="m-0 font-body text-sm leading-relaxed text-foreground/80">
            {errorMessage || "This link may have expired or already been used."}
          </p>
          <p className="m-0 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            {"// request a new link from login"}
          </p>
          <Button asChild variant="brand-dark" size="brand">
            <Link href="/login">Back to login</Link>
          </Button>
        </div>
      </StateCard>
    )
  }

  return (
    <StateCard>
      <div className="flex flex-col items-center gap-4">
        <IconTile tone="yellow">
          <Mail />
        </IconTile>
        <h1 className="m-0 font-display text-4xl leading-none tracking-tight text-foreground">
          check your email
        </h1>
        <p className="m-0 font-body text-base leading-relaxed text-foreground/80">
          We&apos;ve sent a verification link to your email. Click the link to
          activate your account.
        </p>
        <p className="m-0 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          {"// check spam if nothing shows"}
        </p>
        <Button asChild variant="brand-dark" size="brand">
          <Link href="/login">Back to login</Link>
        </Button>
      </div>
    </StateCard>
  )
}

export default function VerifyAccount() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="size-10 animate-spin text-foreground" />
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  )
}
