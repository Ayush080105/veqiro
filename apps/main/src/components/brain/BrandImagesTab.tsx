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
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"

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
  const [deleteTarget, setDeleteTarget] = useState<BrandImage | null>(null)

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

  const handleDelete = () => {
    if (!deleteTarget) return
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    })
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
    <div className="flex flex-col gap-4 pt-4 pb-6">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-foreground">Brand Images</div>
          <p className="mt-0.5 font-mono text-[11px] tracking-[0.03em] text-muted-foreground">
            Save up to {MAX_BRAND_IMAGES} images to use as references in Maya posts.
          </p>
        </div>
        <Badge variant={atMax ? "destructive" : "outline"} className="shrink-0">
          {images.length} / {MAX_BRAND_IMAGES}
        </Badge>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 font-mono text-[11px] text-destructive">
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Images grid */}
      {!isLoading && images.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
          {images.map((img) => (
            <div
              key={img.id}
              className="flex flex-col overflow-hidden rounded-(--vq-r) border border-(--vq-line-2) bg-card shadow-(--vq-shadow-sm)"
            >
              {/* Thumbnail */}
              <div className="flex aspect-square w-full items-center justify-center overflow-hidden border-b border-(--vq-line-2) bg-white">
                <img
                  src={img.url}
                  alt={img.name || "Brand image"}
                  className="h-full w-full object-cover"
                />
              </div>

              {/* Name + actions */}
              <div className="flex flex-1 flex-col gap-1.5 p-2.5">
                {editingId === img.id ? (
                  <Input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => void saveEdit(img.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveEdit(img.id)
                      if (e.key === "Escape") setEditingId(null)
                    }}
                    maxLength={200}
                    className="h-7 text-xs"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => startEdit(img)}
                    title="Click to rename"
                    className="w-full cursor-text truncate text-left font-body text-xs text-foreground"
                  >
                    {img.name || <span className="text-muted-foreground">Unnamed</span>}
                  </button>
                )}

                <Button
                  type="button"
                  variant="destructive"
                  size="xs"
                  className="self-start"
                  onClick={() => setDeleteTarget(img)}
                >
                  <Trash2 className="size-2.5" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && images.length === 0 && !pending && (
        <EmptyState
          icon={<Images />}
          title="No brand images yet"
          description="Add images like team photos, product shots, or any visual asset Maya can use in generated posts."
        />
      )}

      {/* Pending upload card */}
      {pending && (
        <div className="flex items-start gap-3 rounded-(--vq-r) border border-chart-2/40 bg-[color-mix(in_srgb,var(--chart-2)_8%,var(--card))] p-3.5">
          <img
            src={pending.previewUrl}
            alt="preview"
            className="size-18 shrink-0 rounded-lg border border-(--vq-line-2) object-cover"
          />
          <div className="flex flex-1 flex-col gap-2">
            <div className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              Name this image
            </div>
            <Input
              autoFocus
              value={pending.name}
              onChange={(e) => setPending((p) => p ? { ...p, name: e.target.value } : p)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleUpload() }}
              maxLength={200}
              placeholder="e.g. Team Photo, Product Shot…"
              className="bg-card"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="brand-dark"
                size="sm"
                onClick={() => void handleUpload()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                {uploading ? "Uploading…" : "Upload"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => {
                  URL.revokeObjectURL(pending.previewUrl)
                  setPending(null)
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add button */}
      {!pending && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={atMax}
          onClick={() => {
            setError(null)
            fileInputRef.current?.click()
          }}
          className={cn("self-start", atMax && "opacity-60")}
        >
          <Plus className="size-3.5" />
          Add Image
        </Button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={handleFileChange}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{deleteTarget?.name || "this image"}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the image. Maya will no longer be able to use it as a
              reference. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete image
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
