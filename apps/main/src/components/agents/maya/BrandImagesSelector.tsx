"use client"

import { Check } from "lucide-react"

import { useBrandImages } from "@/lib/api/brand-images"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

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
      onPromptChange(id, "")
    } else {
      onSelectionChange([...selected, id])
    }
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2">
        {images.map((img) => {
          const isSelected = selected.includes(img.id)
          return (
            <button
              key={img.id}
              type="button"
              onClick={() => toggle(img.id)}
              title={img.name || "Brand image"}
              aria-pressed={isSelected}
              className={cn(
                "relative flex flex-col items-center gap-0.5 rounded-lg border p-0.5 outline-none",
                isSelected
                  ? "border-chart-2 bg-[color-mix(in_srgb,var(--chart-2)_14%,var(--card))]"
                  : "border-(--vq-line-2) bg-card"
              )}
            >
              <img
                src={img.url}
                alt={img.name || "brand image"}
                className="aspect-square w-full rounded-md object-cover"
              />
              {isSelected && (
                <span className="absolute top-1 right-1 flex size-3.5 items-center justify-center rounded-full bg-chart-2 text-white">
                  <Check className="size-2.5" strokeWidth={3} />
                </span>
              )}
              <span className="w-full truncate pb-0.5 text-center font-mono text-[9px] tracking-[0.02em] text-muted-foreground">
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
                  className="mt-0.5 size-6 shrink-0 rounded border border-border object-cover"
                />
                <Input
                  value={prompts[id] ?? ""}
                  onChange={(e) => onPromptChange(id, e.target.value)}
                  placeholder={`How should Maya use "${img.name || "this image"}"? (optional)`}
                  maxLength={1000}
                  className="flex-1"
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
