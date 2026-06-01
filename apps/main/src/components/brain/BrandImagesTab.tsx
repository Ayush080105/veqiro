"use client"

import { useRef, useState } from "react"
import { Loader2, Plus, Trash2, Upload, Images } from "lucide-react"
import {
  useBrandImages,
  useDeleteBrandImage,
  uploadBrandImage,
  BRAND_IMAGES_KEY,
  type BrandImage,
} from "@/lib/api/brand-images"
import { FONT } from "@/lib/fonts"
import { useQueryClient } from "@tanstack/react-query"

const MAX_BRAND_IMAGES = 20
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"]

interface PendingUpload {
  file: File
  previewUrl: string
  name: string
}

export function BrandImagesTab() {
  const { data: images = [], isLoading } = useBrandImages()
  const deleteMutation = useDeleteBrandImage()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [pending, setPending] = useState<PendingUpload | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")

  const atMax = images.length >= MAX_BRAND_IMAGES

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("PNG, JPEG, or WebP only.")
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be under 10MB.")
      return
    }
    const previewUrl = URL.createObjectURL(file)
    const name = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ").slice(0, 60)
    setPending({ file, previewUrl, name })
  }

  const handleUpload = async () => {
    if (!pending) return
    const name = pending.name.trim() || "Brand image"
    setUploading(true)
    setError(null)
    const result = await uploadBrandImage(pending.file, name)
    setUploading(false)
    if (result.ok) {
      URL.revokeObjectURL(pending.previewUrl)
      setPending(null)
      queryClient.invalidateQueries({ queryKey: BRAND_IMAGES_KEY })
    } else {
      setError(result.message)
    }
  }

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id)
  }

  const startEdit = (img: BrandImage) => {
    setEditingId(img.id)
    setEditName(img.name)
  }

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/brand-images/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: editName.trim() }),
      })
      queryClient.invalidateQueries({ queryKey: BRAND_IMAGES_KEY })
    } catch {
      // silently ignore
    }
    setEditingId(null)
  }

  return (
    <div style={{ paddingTop: 16, paddingBottom: 24 }}>
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontFamily: FONT.head, fontSize: 15, color: "#111", marginBottom: 2 }}>
            Brand Images
          </div>
          <div style={{ fontFamily: FONT.mono, fontSize: 11, color: "#666", letterSpacing: 0.5 }}>
            Save up to {MAX_BRAND_IMAGES} images to use as references in Maya posts.
          </div>
        </div>
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: 1,
            color: atMax ? "#8B1E1E" : "#555",
            background: atMax ? "#FFE4E4" : "#F4EFE6",
            border: `1.5px solid ${atMax ? "#F06464" : "#D6C89A"}`,
            borderRadius: 999,
            padding: "3px 10px",
            whiteSpace: "nowrap",
          }}
        >
          {images.length} / {MAX_BRAND_IMAGES}
        </div>
      </div>

      {/* Error */}
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
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Images grid */}
      {!isLoading && images.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: 12,
            marginBottom: 16,
          }}
        >
          {images.map((img) => (
            <div
              key={img.id}
              style={{
                border: "2px solid #111",
                borderRadius: 12,
                background: "#FFF9ED",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Thumbnail */}
              <div
                style={{
                  width: "100%",
                  aspectRatio: "1 / 1",
                  background: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  borderBottom: "1.5px solid #E5DCC8",
                }}
              >
                <img
                  src={img.url}
                  alt={img.name || "Brand image"}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>

              {/* Name + actions */}
              <div style={{ padding: "8px 10px", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                {editingId === img.id ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => void saveEdit(img.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveEdit(img.id)
                      if (e.key === "Escape") setEditingId(null)
                    }}
                    maxLength={200}
                    style={{
                      fontFamily: FONT.body,
                      fontSize: 12,
                      border: "1.5px solid #111",
                      borderRadius: 6,
                      padding: "3px 6px",
                      width: "100%",
                      background: "#fff",
                      outline: "none",
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => startEdit(img)}
                    title="Click to rename"
                    style={{
                      fontFamily: FONT.body,
                      fontSize: 12,
                      color: "#111",
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "text",
                      textAlign: "left",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      width: "100%",
                    }}
                  >
                    {img.name || <span style={{ color: "#999" }}>Unnamed</span>}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleDelete(img.id)}
                  disabled={deleteMutation.isPending}
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 10,
                    letterSpacing: 1,
                    background: "#FFE4E4",
                    border: "1.5px solid #F06464",
                    borderRadius: 6,
                    padding: "3px 8px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    color: "#8B1E1E",
                    alignSelf: "flex-start",
                  }}
                >
                  <Trash2 className="size-2.5" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && images.length === 0 && !pending && (
        <div
          style={{
            border: "2.5px dashed #111",
            borderRadius: 12,
            background: "#FFF9ED",
            padding: 32,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            marginBottom: 16,
          }}
        >
          <Images className="size-8 text-muted-foreground" />
          <div style={{ fontFamily: FONT.head, fontSize: 14, color: "#111" }}>
            No brand images yet
          </div>
          <div style={{ fontFamily: FONT.mono, fontSize: 11, color: "#666", textAlign: "center", maxWidth: 280 }}>
            Add images like team photos, product shots, or any visual asset Maya can use in generated posts.
          </div>
        </div>
      )}

      {/* Pending upload card */}
      {pending && (
        <div
          style={{
            border: "2px solid #1DBC87",
            borderRadius: 12,
            background: "#E5F7EE",
            padding: 14,
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
            marginBottom: 12,
          }}
        >
          <img
            src={pending.previewUrl}
            alt="preview"
            style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1.5px solid #111", flexShrink: 0 }}
          />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: 1, color: "#555", textTransform: "uppercase" }}>
              Name this image
            </div>
            <input
              autoFocus
              value={pending.name}
              onChange={(e) => setPending((p) => p ? { ...p, name: e.target.value } : p)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleUpload() }}
              maxLength={200}
              placeholder="e.g. Team Photo, Product Shot…"
              style={{
                fontFamily: FONT.body,
                fontSize: 13,
                border: "1.5px solid #111",
                borderRadius: 8,
                padding: "5px 10px",
                background: "#fff",
                outline: "none",
                width: "100%",
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => void handleUpload()}
                disabled={uploading}
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 11,
                  letterSpacing: 1,
                  background: "#111",
                  color: "#fff",
                  border: "2px solid #111",
                  borderRadius: 999,
                  padding: "5px 14px",
                  cursor: uploading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                {uploading ? "Uploading…" : "Upload"}
              </button>
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(pending.previewUrl)
                  setPending(null)
                }}
                disabled={uploading}
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 11,
                  letterSpacing: 1,
                  background: "#fff",
                  color: "#111",
                  border: "2px solid #111",
                  borderRadius: 999,
                  padding: "5px 14px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add button */}
      {!pending && (
        <button
          type="button"
          disabled={atMax}
          onClick={() => {
            setError(null)
            fileInputRef.current?.click()
          }}
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: 1,
            textTransform: "uppercase",
            background: atMax ? "#F2EAD8" : "#FFF9ED",
            border: "2px solid #111",
            borderRadius: 999,
            padding: "6px 16px",
            cursor: atMax ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: atMax ? "#999" : "#111",
            opacity: atMax ? 0.6 : 1,
          }}
        >
          <Plus className="size-3.5" />
          Add Image
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
    </div>
  )
}
