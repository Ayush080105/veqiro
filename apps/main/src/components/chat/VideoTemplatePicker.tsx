"use client"

import * as React from "react"
import { Search } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { VIDEO_PROMPT_TEMPLATES, type VideoPromptTemplate } from "@/lib/agents/maya/videoTemplates"

function useFilteredGroupedTemplates(query: string) {
  return React.useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? VIDEO_PROMPT_TEMPLATES.filter(
          (t) =>
            t.label.toLowerCase().includes(q) ||
            t.slashCommand.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q)
        )
      : VIDEO_PROMPT_TEMPLATES

    const groups: { category: string; templates: VideoPromptTemplate[] }[] = []
    for (const template of filtered) {
      const last = groups[groups.length - 1]
      if (last && last.category === template.category) last.templates.push(template)
      else groups.push({ category: template.category, templates: [template] })
    }
    return groups
  }, [query])
}

/** Single-select: clicking a template picks it immediately — no "Continue" step. */
export function VideoTemplatePicker({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSelect: (template: VideoPromptTemplate) => void
}) {
  const [query, setQuery] = React.useState("")
  const groups = useFilteredGroupedTemplates(query)

  React.useEffect(() => {
    if (open) setQuery("")
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Video ad templates</DialogTitle>
          <DialogDescription>
            Pick a ready-made ad format — you&apos;ll add product photos next.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates (e.g. unboxing, festive, spotlight)"
              className="pl-8"
            />
          </div>
          <div className="flex max-h-96 flex-col gap-3 overflow-y-auto rounded border border-border p-2">
            {groups.length === 0 && (
              <p className="p-2 text-xs text-muted-foreground">No templates match &ldquo;{query}&rdquo;.</p>
            )}
            {groups.map((g) => (
              <div key={g.category} className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {g.category}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {g.templates.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => {
                        onSelect(tpl)
                        onOpenChange(false)
                      }}
                      title={tpl.description}
                      className="rounded-full px-2.5 py-1 text-xs transition-colors"
                      style={{
                        border: "2px solid var(--border)",
                        background: "transparent",
                        color: "var(--foreground)",
                        fontWeight: 400,
                      }}
                    >
                      {tpl.slashCommand}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
