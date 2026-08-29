"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Sparkles,
  LayoutList,
} from "lucide-react"

import { AGENT_PROOFS } from "@/lib/agent-proofs"
import { cn } from "@/lib/utils"

const ROTATE_MS = 3000

const LoginBg = () => {
  const [active, setActive] = useState(0)
  const [rotationKey, setRotationKey] = useState(0)
  const agent = AGENT_PROOFS[active]!

  const goTo = (index: number) => {
    setActive((index + AGENT_PROOFS.length) % AGENT_PROOFS.length)
    setRotationKey((key) => key + 1)
  }

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const id = window.setInterval(() => {
      setActive((current) => (current + 1) % AGENT_PROOFS.length)
    }, ROTATE_MS)

    return () => window.clearInterval(id)
  }, [rotationKey])

  return (
    <aside
      className="relative hidden h-full w-full overflow-hidden bg-background text-foreground lg:block"
      aria-label="Veqiro AI crew on shift"
    >
      <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(90deg,rgba(17,17,17,.12)_1px,transparent_1px),linear-gradient(rgba(17,17,17,.1)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div
        className="absolute right-12 top-16 h-60 w-60 rounded-full blur-3xl"
        style={{ backgroundColor: agent.accent, opacity: 0.4 }}
        aria-hidden
      />
      <div className="absolute bottom-12 left-16 h-56 w-56 rounded-full bg-card blur-3xl opacity-70" aria-hidden />

      <div className="relative z-10 grid h-full w-full grid-rows-[auto_minmax(0,1fr)_auto] gap-4 p-6 xl:p-8">
        <div className="flex items-start justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 border border-[var(--vq-line-2)] bg-accent px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] shadow-[var(--vq-shadow)]">
              <Sparkles className="size-3.5" aria-hidden />
              Crew on shift
            </div>
            <h2 className="mt-4 max-w-xl font-display text-[44px] leading-none tracking-normal xl:text-[52px]">
              Six AI employees clocked in.
            </h2>
          </div>

          
        </div>

        <div className="grid min-h-0 items-center">
          <div className="relative min-h-0">
            <div className="relative grid min-h-[420px] grid-cols-[minmax(190px,245px)_minmax(0,1fr)] gap-5 rounded-[var(--vq-r-lg)] border border-[var(--vq-line-2)] bg-card p-5 shadow-[var(--vq-shadow-lg)] xl:min-h-[440px] xl:grid-cols-[265px_minmax(0,1fr)]">
              <div className="grid min-h-0 content-between gap-4">
                <div className="min-w-0">
                  <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Meet the crew
                  </div>
                  <h3 className="mt-2 font-display text-[42px] leading-none tracking-normal xl:text-[50px]">
                    Meet {agent.name}
                  </h3>
                  <p className="mt-2 font-head text-sm uppercase leading-tight tracking-normal text-foreground/75">
                    {agent.role}
                  </p>
                </div>

                <div className="relative">
                  <div className="relative overflow-hidden rounded-[var(--vq-r)] border border-[var(--vq-line-2)] bg-background shadow-[var(--vq-shadow)]">
                    <div className="relative aspect-[4/5]">
                      <Image
                        key={agent.file}
                        src={agent.file}
                        alt={`${agent.name} portrait`}
                        fill
                        priority={active === 0}
                        sizes="(min-width: 1280px) 285px, 36vw"
                        className="object-cover object-center"
                      />
                    </div>
                    <div
                      className="absolute bottom-3 left-3 rounded-[var(--vq-r-sm)] border border-[var(--vq-line-2)] px-3 py-1 font-head text-xs uppercase tracking-wider shadow-[var(--vq-shadow-sm)]"
                      style={{ backgroundColor: agent.accent }}
                    >
                      {agent.name}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid min-h-0 content-between gap-4">
                <div className="flex justify-end">
                  <div
                    className="border border-[var(--vq-line-2)] px-3 py-1 font-head text-xs uppercase tracking-wider shadow-[var(--vq-shadow-sm)]"
                    style={{ backgroundColor: agent.accent }}
                  >
                    active now
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="rounded-[var(--vq-r)] border border-[var(--vq-line-2)] bg-background px-4 py-3 shadow-[var(--vq-shadow)]">
                    <div className="mb-3 inline-flex rounded-full border border-[var(--vq-line-2)] bg-card px-2.5 py-1 font-mono text-[9px] uppercase leading-none tracking-[0.22em] text-foreground/75">
                      What I handle
                    </div>
                    <p className="max-w-[30rem] text-balance font-body text-[19px] font-semibold leading-[1.18] tracking-normal text-foreground xl:text-[22px]">
                      {agent.does}
                    </p>
                    <p className="mt-4 border-t border-dashed border-[var(--vq-line-2)] pt-3 font-body text-[14px] leading-[1.45] text-foreground/70 xl:text-[15px]">
                      {agent.saves}
                    </p>
                  </div>

                  <div className="rounded-[var(--vq-r)] border border-[var(--vq-line-2)] bg-background px-4 py-3 shadow-[var(--vq-shadow)]">
                    <div className="mb-3 flex items-center gap-2 font-mono text-[9px] uppercase leading-none tracking-[0.22em] text-muted-foreground">
                      <LayoutList className="size-4" aria-hidden />
                      My tasks
                    </div>
                    <ul className="grid gap-2">
                      {agent.tasks.map((task, index) => (
                        <li
                          key={task}
                          className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-start gap-2.5 font-body text-[14px] leading-[1.35] text-foreground/88"
                        >
                          <span className="relative mt-0.5 grid size-5 place-items-center">
                            <CheckCircle2
                              className="size-4"
                              style={{ color: agent.accent }}
                              aria-hidden
                            />
                            <span className="sr-only">Task {index + 1}</span>
                          </span>
                          <span className="max-w-[31rem]">{task}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div
                    className="rounded-[var(--vq-r)] border border-[var(--vq-line-2)] p-3 shadow-[var(--vq-shadow)]"
                    style={{ backgroundColor: agent.accent }}
                  >
                    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-foreground/70">
                      <Clock3 className="size-4" aria-hidden />
                      Saves you
                    </div>
                    <strong className="mt-1 block font-head text-xl uppercase leading-none tracking-normal xl:text-2xl">
                      {agent.timeSaved}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-[var(--vq-r)] border border-[var(--vq-line-2)] bg-card px-4 py-3 shadow-[var(--vq-shadow)]">
          <div className="grid grid-cols-6 gap-2">
            {AGENT_PROOFS.map((item, index) => (
              <button
                key={item.name}
                type="button"
                onClick={() => goTo(index)}
                className={cn(
                  "group grid min-w-0 gap-1 rounded-[var(--vq-r-sm)] border border-[var(--vq-line-2)] bg-background px-2 py-1 text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground",
                  index === active && "shadow-[var(--vq-shadow-sm)]"
                )}
                aria-label={`Show ${item.name}`}
                aria-pressed={index === active}
              >
                <span
                  className="grid size-6 place-items-center rounded-full border border-[var(--vq-line-2)] font-head text-[10px] uppercase"
                  style={{ backgroundColor: item.accent }}
                  aria-hidden
                >
                  {item.name.slice(0, 1)}
                </span>
                <span className="truncate font-head text-xs uppercase leading-none tracking-normal">
                  {item.name}
                </span>
              </button>
            ))}
          </div>
          
        </div>
      </div>
    </aside>
  )
}

export default LoginBg
