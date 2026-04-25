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
import { FONT } from "@/lib/fonts"

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
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 11,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "#555",
        }}
      >
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
        style={{
          position: "relative",
          minHeight: 120,
          borderRadius: 12,
          border: `2.5px dashed ${dragOver ? "#1DBC87" : "#111"}`,
          background: disabled ? "#F2EAD8" : dragOver ? "#E5F7EE" : "#FFF9ED",
          opacity: disabled ? 0.6 : 1,
          padding: 14,
          display: "flex",
          alignItems: "center",
          gap: 14,
          cursor: disabled || busy ? "not-allowed" : "pointer",
        }}
        onClick={() => {
          if (!disabled && !busy && !value) pick()
        }}
      >
        {value ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              width: "100%",
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  width: 92,
                  height: 92,
                  background: "#fff",
                  border: "2px solid #111",
                  borderRadius: 10,
                  position: "relative",
                  overflow: "hidden",
                  flexShrink: 0,
                }}
              >
                <Image
                  src={value}
                  alt={`${kind} preview`}
                  fill
                  sizes="92px"
                  style={{ objectFit: "contain" }}
                  unoptimized
                />
                <a
                  href={value ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Open ${kind} in new tab`}
                  title="Open in new tab"
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    width: 24,
                    height: 24,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(255,255,255,0.95)",
                    border: "1.5px solid #111",
                    borderRadius: 6,
                    color: "#111",
                    textDecoration: "none",
                    cursor: "pointer",
                  }}
                >
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    fontFamily: FONT.head,
                    fontSize: 13,
                    color: "#111",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span aria-hidden>✓</span>
                  <span>Uploaded</span>
                </div>
                <div
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 10,
                    letterSpacing: 0.5,
                    color: "#666",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={value ?? undefined}
                >
                  {filenameFromUrl(value)}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                disabled={busy || disabled}
                onClick={(e) => {
                  e.stopPropagation()
                  pick()
                }}
                style={btnStyle("#fff", { flex: 1, justifyContent: "center" })}
              >
                {busy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Upload className="size-3.5" />
                )}
                Replace
              </button>
              <button
                type="button"
                disabled={busy || disabled}
                onClick={(e) => {
                  e.stopPropagation()
                  void handleRemove()
                }}
                style={btnStyle("#FFE4E4", { flex: 1, justifyContent: "center" })}
              >
                <X className="size-3.5" />
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 6,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontFamily: FONT.head,
                fontSize: 14,
                color: "#111",
              }}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {busy ? "Uploading…" : "Drop or click to upload"}
            </div>
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: 11,
                color: "#555",
                letterSpacing: 0.5,
              }}
            >
              {hint ?? "PNG · JPEG · WebP · SVG · max 5MB"}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            color: "#8B1E1E",
            background: "#FFE4E4",
            border: "1.5px solid #F06464",
            borderRadius: 8,
            padding: "6px 10px",
          }}
        >
          {error}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_ASSET_TYPES.join(",")}
        style={{ display: "none" }}
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

function btnStyle(
  bg: string,
  overrides?: React.CSSProperties,
): React.CSSProperties {
  return {
    fontFamily: FONT.mono,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    background: bg,
    border: "2px solid #111",
    borderRadius: 999,
    padding: "5px 12px",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    color: "#111",
    ...overrides,
  }
}
