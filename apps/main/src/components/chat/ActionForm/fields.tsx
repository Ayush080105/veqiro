"use client"

import * as React from "react"
import { Plus, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ContentPlatform, DataPoint } from "@/lib/types/agents"

// ─── Labeled field wrapper ───────────────────────────────────────────────────

export function FormRow({
  label,
  hint,
  children,
  required,
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

// ─── String-list input (URLs, keywords, clauses, etc.) ──────────────────────

export function StringListInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  type?: "text" | "url"
}) {
  const [draft, setDraft] = React.useState("")
  const add = () => {
    const v = draft.trim()
    if (!v) return
    onChange([...value, v])
    setDraft("")
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1.5">
        <Input
          type={type}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              add()
            }
          }}
        />
        <Button type="button" variant="outline" size="icon" onClick={add} aria-label="Add">
          <Plus />
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((v, i) => (
            <Badge
              key={`${v}-${i}`}
              variant="secondary"
              className="pr-1 gap-1 max-w-full overflow-hidden"
            >
              <span className="truncate">{v}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="rounded-full hover:bg-foreground/10 p-0.5"
                aria-label={`Remove ${v}`}
              >
                <X className="size-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Platform selector ───────────────────────────────────────────────────────

const PLATFORMS: { id: ContentPlatform; label: string }[] = [
  { id: "linkedin", label: "LinkedIn" },
  { id: "twitter", label: "Twitter / X" },
  { id: "instagram", label: "Instagram" },
]

export function PlatformPicker({
  value,
  onChange,
}: {
  value: ContentPlatform
  onChange: (p: ContentPlatform) => void
}) {
  return (
    <div className="flex gap-1.5">
      {PLATFORMS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onChange(p.id)}
          className={cn(
            "flex-1 border border-border px-2 py-1.5 text-xs transition-colors",
            value === p.id
              ? "bg-primary text-primary-foreground border-primary"
              : "hover:bg-muted"
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}

export function PlatformMultiPicker({
  value,
  onChange,
}: {
  value: ContentPlatform[]
  onChange: (next: ContentPlatform[]) => void
}) {
  const toggle = (p: ContentPlatform) => {
    onChange(value.includes(p) ? value.filter((x) => x !== p) : [...value, p])
  }
  return (
    <div className="flex gap-1.5">
      {PLATFORMS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => toggle(p.id)}
          className={cn(
            "flex-1 border border-border px-2 py-1.5 text-xs transition-colors",
            value.includes(p.id)
              ? "bg-primary text-primary-foreground border-primary"
              : "hover:bg-muted"
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}

// ─── Counter textarea ────────────────────────────────────────────────────────

export function CountedTextarea({
  value,
  onChange,
  max,
  placeholder,
  rows = 4,
}: {
  value: string
  onChange: (v: string) => void
  max?: number
  placeholder?: string
  rows?: number
}) {
  return (
    <div className="flex flex-col gap-1">
      <Textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="resize-y"
      />
      {max != null && (
        <div className="flex justify-end">
          <span
            className={cn(
              "text-[10px]",
              value.length > max ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {value.length}/{max}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Data-point table (for Rex metrics) ──────────────────────────────────────

export function DataPointTable({
  value,
  onChange,
}: {
  value: DataPoint[]
  onChange: (next: DataPoint[]) => void
}) {
  const updateRow = (i: number, patch: Partial<DataPoint>) => {
    onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }
  const addRow = () =>
    onChange([
      ...value,
      { date: new Date().toISOString().slice(0, 10), value: 0 },
    ])
  const removeRow = (i: number) => onChange(value.filter((_, j) => j !== i))

  return (
    <div className="flex flex-col gap-1.5">
      {value.length === 0 && (
        <p className="text-[10px] text-muted-foreground">
          No data points yet — add at least 3.
        </p>
      )}
      {value.map((row, i) => (
        <div key={i} className="flex gap-1.5">
          <Input
            type="date"
            value={row.date}
            onChange={(e) => updateRow(i, { date: e.target.value })}
          />
          <Input
            type="number"
            step="any"
            value={row.value}
            onChange={(e) => updateRow(i, { value: Number(e.target.value) })}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removeRow(i)}
            aria-label="Remove row"
          >
            <X />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addRow}
        className="self-start"
      >
        <Plus data-icon="inline-start" /> Add row
      </Button>
      <p className="text-[10px] text-muted-foreground">
        Tip: paste CSV (date,value per line) into the first cell to bulk-import.
      </p>
    </div>
  )
}

// ─── File-to-base64 ──────────────────────────────────────────────────────────

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const res = reader.result as string
      // Strip data URL prefix
      const idx = res.indexOf(",")
      resolve(idx >= 0 ? res.slice(idx + 1) : res)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
