"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { Loader2, Upload, X } from "lucide-react"

import {
  ALLOWED_ASSET_TYPES,
  MAX_ASSET_BYTES,
} from "@/lib/schemas/brand-kit"
import {
  uploadBrandAsset,
  removeBrandAsset,
  type UploadKind,
} from "@/lib/api/brain"
import { FONT } from "@/components/veqiro/shared"

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
          <>
            <div
              style={{
                width: 84,
                height: 84,
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
                sizes="84px"
                style={{ objectFit: "contain" }}
                unoptimized
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
              <div
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 11,
                  letterSpacing: 1,
                  color: "#111",
                  wordBreak: "break-all",
                }}
              >
                {value}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  disabled={busy || disabled}
                  onClick={(e) => {
                    e.stopPropagation()
                    pick()
                  }}
                  style={btnStyle("#fff")}
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
                  style={btnStyle("#FFE4E4")}
                >
                  <X className="size-3.5" />
                  Remove
                </button>
              </div>
            </div>
          </>
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

function btnStyle(bg: string): React.CSSProperties {
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
  }
}
