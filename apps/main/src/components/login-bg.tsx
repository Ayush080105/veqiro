"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight } from "lucide-react"

const AGENTS = [
  { name: "Lex", file: "/Lex.jpeg" },
  { name: "Maya", file: "/Maya.jpeg" },
  { name: "Rex", file: "/Rex.jpeg" },
  { name: "Sage", file: "/Sage.jpeg" },
  { name: "Scout", file: "/Scout.jpeg" },
  { name: "Vega", file: "/Vega.jpeg" },
]

const INTERVAL = 4500
const FLIP_MS = 700

const LoginBg = () => {
  // `back` is the page already visible underneath
  // `front` is the page currently folding away (null when idle)
  const [back, setBack] = useState(0)
  const [front, setFront] = useState<number | null>(null)
  const [flipAngle, setFlipAngle] = useState(0)
  const [shadowOpacity, setShadowOpacity] = useState(0)
  const [busy, setBusy] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const navigate = useCallback(
    (target: number) => {
      if (busy) return
      const idx = (target + AGENTS.length) % AGENTS.length
      if (idx === back) return

      setBusy(true)
      setFront(back)      // old page goes on top and will flip away
      setBack(idx)        // new page is immediately visible underneath
      setFlipAngle(0)     // reset angle (page starts flat)
      setShadowOpacity(0.55)

      // kick off the flip on next paint so CSS transition fires
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setFlipAngle(-180)   // flip the old page away (left spine stays, right edge folds left)
          setShadowOpacity(0)
        }),
      )

      setTimeout(() => {
        setFront(null)
        setBusy(false)
      }, FLIP_MS + 50)
    },
    [back, busy],
  )

  const goNext = useCallback(() => navigate(back + 1), [back, navigate])
  const goPrev = useCallback(() => navigate(back - 1), [back, navigate])

  useEffect(() => {
    timerRef.current = setTimeout(goNext, INTERVAL)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [goNext])

  return (
    <div
      className="relative h-full w-full overflow-hidden border-l-[3px] border-foreground bg-background"
      style={{ perspective: "1600px", perspectiveOrigin: "center center" }}
    >
      {/* ── BACK PAGE (incoming, revealed as front flips away) ── */}
      <div className="absolute inset-0">
        {/* blurred backdrop */}
        <Image
          src={AGENTS[back]!.file}
          alt=""
          fill
          className="object-cover"
          style={{ filter: "blur(20px) brightness(0.65)", transform: "scale(1.12)" }}
          aria-hidden
        />
        {/* full image */}
        <Image
          src={AGENTS[back]!.file}
          alt={AGENTS[back]!.name}
          fill
          className="object-contain"
        />
        {/* shadow cast by the flipping page on top — fades as flip completes */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "linear-gradient(to right, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.15) 50%, transparent 100%)",
            opacity: shadowOpacity,
            transition: `opacity ${FLIP_MS}ms ease-in`,
          }}
        />
      </div>

      {/* ── FRONT PAGE (outgoing, flips away like a book page) ── */}
      {front !== null && (
        <div
          className="absolute inset-0"
          style={{
            transformOrigin: "left center",
            transform: `rotateY(${flipAngle}deg)`,
            transition: `transform ${FLIP_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
            backfaceVisibility: "hidden",
            willChange: "transform",
          }}
        >
          {/* blurred backdrop */}
          <Image
            src={AGENTS[front]!.file}
            alt=""
            fill
            className="object-cover"
            style={{ filter: "blur(20px) brightness(0.65)", transform: "scale(1.12)" }}
            aria-hidden
          />
          {/* full image */}
          <Image
            src={AGENTS[front]!.file}
            alt=""
            fill
            className="object-contain"
            aria-hidden
          />
          {/* right-edge shading — simulates page curl/depth */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: "linear-gradient(to left, rgba(0,0,0,0.25) 0%, transparent 40%)",
            }}
          />
        </div>
      )}

      {/* ── CONTROLS ── */}
      <button
        onClick={goPrev}
        className="absolute left-3 top-1/2 z-30 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/40 bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
        aria-label="Previous agent"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <button
        onClick={goNext}
        className="absolute right-3 top-1/2 z-30 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/40 bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
        aria-label="Next agent"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      <div className="absolute bottom-5 left-1/2 z-30 flex -translate-x-1/2 gap-2">
        {AGENTS.map((_, i) => (
          <button
            key={i}
            onClick={() => navigate(i)}
            className="h-2 w-2 rounded-full border border-white/60 transition-colors"
            style={{ background: i === back ? "white" : "transparent" }}
            aria-label={`Go to ${AGENTS[i]!.name}`}
          />
        ))}
      </div>
    </div>
  )
}

export default LoginBg
