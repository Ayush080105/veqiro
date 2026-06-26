import { Lock } from "lucide-react"
import { Sticker } from "@/components/ui/sticker"
import { FONT } from "@/lib/fonts"

interface FeatureLockBannerProps {
  title: string
  description: string
}

export function FeatureLockBanner({ title, description }: FeatureLockBannerProps) {
  return (
    <div
      className="flex min-h-[320px] flex-1 flex-col items-center justify-center gap-5 p-10 text-center"
      style={{ background: "#EFE7D6" }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Lock style={{ width: 30, height: 30, color: "#555" }} />
      </div>

      <Sticker rotate={-3} tone="yellow">
        coming soon
      </Sticker>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 440 }}>
        <h2
          style={{
            fontFamily: FONT.display,
            fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)",
            lineHeight: 1,
            color: "#111",
            margin: 0,
            letterSpacing: -0.5,
          }}
        >
          {title}
        </h2>
        <p
          style={{
            fontFamily: FONT.body,
            fontSize: 14,
            lineHeight: 1.65,
            color: "#555",
            margin: 0,
          }}
        >
          {description}
        </p>
        <p
          style={{
            fontFamily: FONT.mono,
            fontSize: 10,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "#999",
            margin: "4px 0 0",
          }}
        >
          {"// google api verification in progress"}
        </p>
      </div>
    </div>
  )
}
