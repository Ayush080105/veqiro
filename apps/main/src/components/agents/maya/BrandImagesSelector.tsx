"use client"

import { useBrandImages } from "@/lib/api/brand-images"
import { FONT } from "@/lib/fonts"

interface BrandImagesSelectorProps {
  selected: string[]
  prompts: Record<string, string>
  onSelectionChange: (ids: string[]) => void
  onPromptChange: (id: string, prompt: string) => void
}

export function BrandImagesSelector({
  selected,
  prompts,
  onSelectionChange,
  onPromptChange,
}: BrandImagesSelectorProps) {
  const { data: images = [], isLoading } = useBrandImages()

  if (isLoading) return null

  if (images.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No brand images — add them in{" "}
        <span className="font-medium">Brain &gt; Brand Images</span>.
      </p>
    )
  }

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onSelectionChange(selected.filter((s) => s !== id))
      // remove prompt entry too
      const next = { ...prompts }
      delete next[id]
      for (const key of Object.keys(prompts)) {
        if (key !== id) continue
        onPromptChange(key, "")
      }
    } else {
      onSelectionChange([...selected, id])
    }
  }

  return (
    <div className="space-y-2">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
          gap: 8,
        }}
      >
        {images.map((img) => {
          const isSelected = selected.includes(img.id)
          return (
            <button
              key={img.id}
              type="button"
              onClick={() => toggle(img.id)}
              title={img.name || "Brand image"}
              style={{
                position: "relative",
                border: `2px solid ${isSelected ? "#1DBC87" : "#D6C89A"}`,
                borderRadius: 8,
                background: isSelected ? "#E5F7EE" : "#FFF9ED",
                padding: 2,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
                outline: "none",
              }}
            >
              <img
                src={img.url}
                alt={img.name || "brand image"}
                style={{
                  width: "100%",
                  aspectRatio: "1/1",
                  objectFit: "cover",
                  borderRadius: 5,
                }}
              />
              {isSelected && (
                <span
                  style={{
                    position: "absolute",
                    top: 3,
                    right: 3,
                    background: "#1DBC87",
                    color: "#fff",
                    borderRadius: "50%",
                    width: 14,
                    height: 14,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 9,
                    fontFamily: FONT.mono,
                  }}
                >
                  ✓
                </span>
              )}
              <span
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 9,
                  letterSpacing: 0.3,
                  color: "#555",
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  width: "100%",
                  textAlign: "center",
                  paddingBottom: 2,
                }}
              >
                {img.name || "—"}
              </span>
            </button>
          )
        })}
      </div>

      {/* Optional instruction per selected image */}
      {selected.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {selected.map((id) => {
            const img = images.find((i) => i.id === id)
            if (!img) return null
            return (
              <div key={id} className="flex items-start gap-2">
                <img
                  src={img.url}
                  alt={img.name}
                  className="h-6 w-6 rounded object-cover border border-border flex-shrink-0 mt-0.5"
                />
                <input
                  type="text"
                  value={prompts[id] ?? ""}
                  onChange={(e) => onPromptChange(id, e.target.value)}
                  placeholder={`How should Maya use "${img.name || "this image"}"? (optional)`}
                  maxLength={1000}
                  className="flex-1 text-xs border border-input rounded-md px-2 py-1 bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
