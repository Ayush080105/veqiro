"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  Building2,
  Check,
  Loader2,
  LogOut,
  Plus,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import Logo from "@/components/logo"
import { authClient } from "@/lib/auth-client"
import {
  clearActiveAndStartNew,
  switchToOrganization,
} from "@/lib/api/organizations"
import { FONT } from "@/lib/fonts"

const LANDING_URL =
  process.env.NEXT_PUBLIC_LANDING_URL ?? "http://localhost:3000"

function WorkspaceSkeleton() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="h-24 animate-pulse rounded-lg border border-[var(--vq-line-2)] bg-white/55 shadow-[var(--vq-shadow-sm)]"
        />
      ))}
    </div>
  )
}

export default function WorkspacesPage() {
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()
  const { data: activeOrg } = authClient.useActiveOrganization()
  const { data: memberships, isPending: isOrgsLoading } =
    authClient.useListOrganizations()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const activeOrgId = activeOrg?.id ?? null
  const userEmail = session?.user?.email ?? ""

  useEffect(() => {
    if (isPending) return
    if (!session?.user) {
      router.replace("/login")
      return
    }
  }, [isPending, router, session?.user])

  const selectWorkspace = async (organizationId: string) => {
    if (pendingId) return
    setPendingId(organizationId)
    await switchToOrganization(organizationId, router)
    setPendingId(null)
  }

  const createWorkspace = async () => {
    if (pendingId) return
    setPendingId("__new__")
    await clearActiveAndStartNew(router)
    setPendingId(null)
  }

  const signOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = LANDING_URL
        },
      },
    })
  }

  return (
    <main className="min-h-screen bg-background px-5 py-6 sm:px-8 sm:py-10">
      <div className="noise-overlay" aria-hidden />
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-3xl flex-col">
        <header className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 text-foreground">
            <Logo className="size-10 shrink-0" />
            <span className="font-display text-3xl leading-none tracking-normal">
              veqiro
            </span>
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="inline-flex items-center gap-2 rounded-md border border-[var(--vq-line-2)] bg-white px-3 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-foreground shadow-[var(--vq-shadow-sm)] transition-colors hover:bg-muted"
          >
            <LogOut className="size-3.5" />
            Sign out
          </button>
        </header>

        <section className="mb-7">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            {userEmail || "Workspace selection"}
          </p>
          <h1 className="font-display text-[clamp(2.25rem,8vw,4.5rem)] leading-none tracking-tight text-foreground">
            choose workspace
          </h1>
        </section>

        {isPending || isOrgsLoading ? (
          <WorkspaceSkeleton />
        ) : (
          <div className="grid gap-3">
            {memberships?.map((membership) => {
              const isCurrent = membership.id === activeOrgId
              const isSwitching = pendingId === membership.id
              const disabled = !!pendingId || isSwitching

              return (
                <button
                  key={membership.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => void selectWorkspace(membership.id)}
                  className="group flex w-full flex-col items-start gap-3 rounded-lg border border-[var(--vq-line-2)] bg-white px-4 py-4 text-left shadow-[var(--vq-shadow-sm)] transition-all hover:shadow-[var(--vq-shadow)] disabled:pointer-events-none disabled:opacity-65 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
                >
                  <span className="flex min-w-0 items-center gap-3 self-stretch sm:flex-1">
                    <span className="grid size-12 shrink-0 place-items-center rounded-md border border-[var(--vq-line-2)] bg-secondary">
                      {isSwitching ? (
                        <Loader2 className="size-5 animate-spin" />
                      ) : (
                        <Building2 className="size-5" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className="block truncate text-base text-foreground"
                        style={{ fontFamily: FONT.head }}
                      >
                        {membership.name}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        <span aria-hidden> / </span>
                        <span>{membership.slug}</span>
                      </span>
                    </span>
                  </span>
                  <span className="flex w-full items-center justify-between gap-3 sm:w-auto">
                    <span
                      className={
                        membership.onboarded
                          ? "rounded-full border border-[var(--vq-line-2)] bg-[color:var(--vq-green)]/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground"
                          : "rounded-full border border-[var(--vq-line-2)] bg-accent/20 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground"
                      }
                    >
                      {membership.onboarded ? "Onboarded" : "Setup needed"}
                    </span>
                    {isCurrent ? (
                      <Check className="size-5 shrink-0 text-foreground" />
                    ) : (
                      <ArrowRight className="size-5 shrink-0 text-foreground transition-transform group-hover:translate-x-0.5" />
                    )}
                  </span>
                </button>
              )
            })}

            <button
              type="button"
              disabled={!!pendingId}
              onClick={() => void createWorkspace()}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--vq-line-2)] bg-transparent px-4 py-4 font-head text-sm uppercase tracking-wider text-foreground transition-colors hover:bg-foreground/5 disabled:pointer-events-none disabled:opacity-65"
            >
              {pendingId === "__new__" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Create new workspace
            </button>
          </div>
        )}

        <div className="mt-auto pt-8">
          <Button
            type="button"
            variant="brand-ghost"
            size="brand-sm"
            onClick={() => router.refresh()}
            disabled={!!pendingId}
          >
            Refresh list
          </Button>
        </div>
      </div>
    </main>
  )
}
