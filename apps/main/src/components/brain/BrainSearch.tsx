"use client"

import { Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"

interface BrainSearchProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function BrainSearch({
  value,
  onChange,
  placeholder = "Search knowledge...",
}: BrainSearchProps) {
  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 w-full min-w-0 rounded-none border-none bg-muted/50 pl-8 pr-8 text-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring/50"
      />
      {value.length > 0 && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute right-0.5 top-1/2 size-6 -translate-y-1/2 text-muted-foreground"
          onClick={() => onChange("")}
        >
          <X className="size-3.5" />
          <span className="sr-only">Clear search</span>
        </Button>
      )}
    </div>
  )
}
