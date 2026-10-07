"use client"

import * as React from "react"
import { Hash, Calendar, List, Type, Loader2, Lock, Search } from "lucide-react"

import { useFields, type FieldView, type ObjectSelection } from "@/lib/api/rexConnections"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { SegmentedGroup } from "@/components/ui/segmented-group"
import { cn } from "@/lib/utils"

type Tab = "recommended" | "custom" | "other"

const KIND_ICON = { numeric: Hash, date: Calendar, categorical: List, text: Type } as const
const KIND_LABEL = { numeric: "Number", date: "Date", categorical: "Choice", text: "Text" } as const

/** "dealinformation" -> "Dealinformation" is ugly; HubSpot group names are snake or flat words. */
const prettyGroup = (g: string | null) => (g ? g.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "Other")

/**
 * Choose which HubSpot fields become columns. The recommended set is always in; everything else is
 * opt-in, up to the column limit, and fields that identify a person need a separate, explicit yes.
 */
export function FieldPicker({
  connectionId,
  objectType,
  value,
  onChange,
}: {
  connectionId: string
  objectType: string
  value: ObjectSelection
  onChange: (next: ObjectSelection) => void
}) {
  const { data, isLoading, error } = useFields(connectionId, objectType)
  const [tab, setTab] = React.useState<Tab>("recommended")
  const [query, setQuery] = React.useState("")

  const all = React.useMemo(() => (data ? [...data.recommended, ...data.custom, ...data.other] : []), [data])
  const locked = (f: FieldView) => f.source === "recommended" && !f.pii
  const isOn = (f: FieldView) => locked(f) || value.extra.includes(f.property) || value.includePii.includes(f.property)
  const used = 1 + all.filter(isOn).length // the record id is always the first column
  const cap = data?.cap ?? 60
  const full = used >= cap

  const toggle = (f: FieldView, on: boolean) => {
    const strip = (xs: string[]) => xs.filter((x) => x !== f.property)
    onChange(
      f.pii
        ? { extra: strip(value.extra), includePii: on ? [...strip(value.includePii), f.property] : strip(value.includePii) }
        : { extra: on ? [...strip(value.extra), f.property] : strip(value.extra), includePii: strip(value.includePii) },
    )
  }

  if (isLoading) {
    return <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Reading your HubSpot fields</div>
  }
  if (error || !data) {
    return <p className="py-4 text-xs text-destructive">Couldn&apos;t load the fields for this object. Check the connection and try again.</p>
  }

  const list = data[tab].filter((f) => !query.trim() || `${f.label} ${f.property}`.toLowerCase().includes(query.trim().toLowerCase()))
  const groups = new Map<string, FieldView[]>()
  for (const f of list) groups.set(prettyGroup(f.group), [...(groups.get(prettyGroup(f.group)) ?? []), f])
  const piiOn = all.some((f) => f.pii && isOn(f))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedGroup
          size="sm"
          value={tab}
          onValueChange={setTab}
          options={[
            { value: "recommended", label: `Recommended (${data.recommended.length})` },
            { value: "custom", label: `Your fields (${data.custom.length})` },
            { value: "other", label: `All HubSpot fields (${data.other.length})` },
          ]}
        />
        <span className={cn("text-xs tabular-nums", full ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
          {used} of {cap} columns
        </span>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search fields" className="pl-8 text-xs" aria-label="Search fields" />
      </div>

      <div className="max-h-64 overflow-y-auto rounded-md border border-border">
        {list.length === 0 ? (
          <p className="p-4 text-center text-xs text-muted-foreground">
            {query ? "No fields match that search." : tab === "custom" ? "No custom fields in this HubSpot account." : "Nothing here."}
          </p>
        ) : (
          [...groups.entries()].map(([group, fields]) => (
            <div key={group}>
              <p className="sticky top-0 border-b border-border bg-muted/60 px-3 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur">{group}</p>
              {fields.map((f) => {
                const on = isOn(f)
                const disabled = locked(f) || (!on && full)
                const Icon = KIND_ICON[f.kind]
                return (
                  <label
                    key={f.property}
                    className={cn("flex items-center gap-2.5 border-b border-border/60 px-3 py-1.5 text-xs last:border-0", disabled ? "opacity-70" : "cursor-pointer hover:bg-muted/40")}
                  >
                    <Checkbox checked={on} disabled={disabled} onCheckedChange={(v) => toggle(f, Boolean(v))} aria-label={f.label} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{f.label}</span>
                      <span className="block truncate font-mono text-[10px] text-muted-foreground">{f.column}</span>
                    </span>
                    {f.pii && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                        <Lock className="size-2.5" /> Personal data
                      </span>
                    )}
                    <span className="inline-flex w-16 shrink-0 items-center gap-1 text-[10px] text-muted-foreground"><Icon className="size-3" />{KIND_LABEL[f.kind]}</span>
                  </label>
                )
              })}
            </div>
          ))
        )}
      </div>

      {piiOn && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs">
          You&apos;ve included personal data. It is stored with this dataset and can appear in tables you share. Rex asks you to confirm before a dashboard that reads it is made public.
        </p>
      )}
      {full && <p className="text-xs text-muted-foreground">Column limit reached. Remove a field to add another.</p>}
    </div>
  )
}
