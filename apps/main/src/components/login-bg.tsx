import { Sticker } from "@/components/ui/sticker"
import Logo from "./logo"

/**
 * Decorative Veqiro panel shown on the right side of auth pages.
 * Pure presentation — cream background with rotated logo tile,
 * stacked sticker accents, and a grainy noise overlay.
 */
const LoginBg = () => {
  return (
    <div className="relative h-full w-full overflow-hidden border-l-[3px] border-foreground bg-background">
      {/* grain overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: 0.05,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
          backgroundSize: "200px 200px",
        }}
      />

      {/* big rotated logo tile */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Logo className="h-56 w-56" />
      </div>

      {/* scattered sticker accents */}
      <div className="absolute left-16 top-12">
        <Sticker rotate={-8} tone="red">six AI employees</Sticker>
      </div>
      <div className="absolute right-10 top-32">
        <Sticker rotate={6} tone="yellow">always on</Sticker>
      </div>
      <div className="absolute bottom-36 left-10">
        <Sticker rotate={-4} tone="green">real jobs</Sticker>
      </div>
      <div className="absolute bottom-16 right-16">
        <Sticker rotate={3} tone="violet">zero chill</Sticker>
      </div>

      {/* tagline */}
      <div className="absolute bottom-8 left-0 right-0 px-8 text-center">
        <p className="font-mono text-[11px] uppercase tracking-widest text-foreground/70">
          {"// hire the whole crew in 60 seconds"}
        </p>
      </div>
    </div>
  )
}

export default LoginBg
