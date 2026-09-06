"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { ExternalLink, Loader2, Upload, X } from "lucide-react"

import {
  ALLOWED_ASSET_TYPES,
  MAX_ASSET_BYTES,
} from "@/lib/schemas/brand-kit"
import {
  uploadBrandAsset,
  removeBrandAsset,
  type UploadKind,
} from "@/lib/api/brain"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface AssetUploadProps {
  kind: UploadKind
  label: string
  hint?: string
  // Current saved value — surfaces an existing logo/mascot.
  value: string | null | undefined
  // Called with the new R2 URL + key after a successful upload, or both null on remove.
  onChange: (next: { url: string | null; key: string | null }) => void
  // Disabled when the org doesn't exist yet (e.g. before workspace creation).
  disabled?: boolean
}

const isAllowed = (type: string): type is (typeof ALLOWED_ASSET_TYPES)[number] =>
  (ALLOWED_ASSET_TYPES as readonly string[]).includes(type)

export function AssetUpload({
  kind,
  label,
  hint,
  value,
  onChange,
  disabled,
}: AssetUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pick = () => inputRef.current?.click()

  const handleFiles = async (files: FileList | null) => {
    setError(null)
    if (!files || files.length === 0) return
    const file = files[0]
    if (!isAllowed(file.type)) {
      setError("PNG, JPEG, WebP or SVG only.")
      return
    }
    if (file.size > MAX_ASSET_BYTES) {
      setError(`Image must be under ${Math.floor(MAX_ASSET_BYTES / 1024 / 1024)}MB.`)
      return
    }

    setBusy(true)
    try {
      const result = await uploadBrandAsset(kind, file)
      if (result.ok) {
        onChange({ url: result.url, key: result.key })
      } else {
        setError(result.message)
      }
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await removeBrandAsset(kind)
      if (result.ok) {
        onChange({ url: null, key: null })
      } else {
        setError(result.message ?? "Could not remove")
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled && !busy) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          if (!disabled && !busy) void handleFiles(e.dataTransfer.files)
        }}
        onClick={() => {
          if (!disabled && !busy && !value) pick()
        }}
        className={cn(
          "relative flex min-h-30 items-center gap-3.5 rounded-(--vq-r) border-2 border-dashed p-3.5",
          dragOver ? "border-chart-2 bg-[color-mix(in_srgb,var(--chart-2)_8%,var(--card))]" : "border-(--vq-line-2) bg-card",
          disabled ? "cursor-not-allowed opacity-60" : busy ? "cursor-not-allowed" : "cursor-pointer"
        )}
      >
        {value ? (
          <div className="flex w-full min-w-0 flex-col gap-2.5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative size-23 shrink-0 overflow-hidden rounded-lg border border-(--vq-line-2) bg-white">
                <Image
                  src={value}
                  alt={`${kind} preview`}
                  fill
                  sizes="92px"
                  className="object-contain"
                  unoptimized
                />
                <a
                  href={value ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Open ${kind} in new tab`}
                  title="Open in new tab"
                  className="absolute top-1 right-1 inline-flex size-6 items-center justify-center rounded-md border border-(--vq-line-2) bg-white/95 text-foreground no-underline"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-1.5 font-head text-[13px] text-foreground">
                  <span aria-hidden>✓</span>
                  <span>Uploaded</span>
                </div>
                <div
                  className="truncate font-mono text-[10px] text-muted-foreground"
                  title={value ?? undefined}
                >
                  {filenameFromUrl(value)}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 justify-center"
                disabled={busy || disabled}
                onClick={(e) => {
                  e.stopPropagation()
                  pick()
                }}
              >
                {busy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Upload className="size-3.5" />
                )}
                Replace
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="flex-1 justify-center"
                disabled={busy || disabled}
                onClick={(e) => {
                  e.stopPropagation()
                  void handleRemove()
                }}
              >
                <X className="size-3.5" />
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-start gap-1.5">
            <div className="flex items-center gap-2 font-head text-sm text-foreground">
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {busy ? "Uploading…" : "Drop or click to upload"}
            </div>
            <div className="font-mono text-[11px] text-muted-foreground">
              {hint ?? "PNG · JPEG · WebP · SVG · max 5MB"}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 font-mono text-[11px] text-destructive">
          {error}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_ASSET_TYPES.join(",")}
        className="sr-only"
        onChange={(e) => {
          void handleFiles(e.target.files)
          e.target.value = "" // allow re-picking same file
        }}
      />
    </div>
  )
}

// Pull a short, human-readable label out of an R2 URL. Keys look like
// `images/<orgId>-<kind>-<uuid>.png` — we just want the last path segment,
// truncated so it doesn't wrap or break the layout.
function filenameFromUrl(url: string | null | undefined): string {
  if (!url) return ""
  try {
    const path = new URL(url).pathname
    const last = path.split("/").pop() ?? ""
    if (last.length <= 32) return last
    const dot = last.lastIndexOf(".")
    const ext = dot > 0 ? last.slice(dot) : ""
    return `${last.slice(0, 28 - ext.length)}…${ext}`
  } catch {
    return url.length > 32 ? `${url.slice(0, 29)}…` : url
  }
}
