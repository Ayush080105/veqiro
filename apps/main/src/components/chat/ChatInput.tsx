"use client"

import * as React from "react"
import { Plus, Send, Paperclip, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export interface ChatInputProps {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  onPlusClick: () => void
  onHelpClick: () => void
  onAttachClick?: () => void
  placeholder?: string
  disabled?: boolean
  max?: number
}

export function ChatInput({
  value,
  onChange,
  onSend,
  onPlusClick,
  onHelpClick,
  onAttachClick,
  placeholder = "Message the agent…",
  disabled = false,
  max = 1000,
}: ChatInputProps) {
  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (canSend) onSend()
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault()
      onPlusClick()
    }
  }

  const charCount = value.length
  const canSend = charCount > 0 && charCount <= max && !disabled

  return (
    <div className="flex flex-col gap-1.5 p-3">
      <div className="flex items-end gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onPlusClick}
          aria-label="Open actions menu"
          title="Actions (Ctrl/Cmd+K)"
        >
          <Plus />
        </Button>

        {onAttachClick && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onAttachClick}
            aria-label="Attach document"
            title="Attach PDF"
          >
            <Paperclip />
          </Button>
        )}

        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKey}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 resize-none min-h-[40px] max-h-[160px]"
        />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onHelpClick}
          aria-label="What can this agent do?"
          title="Capabilities"
        >
          <HelpCircle />
        </Button>

        <Button
          type="button"
          size="icon"
          onClick={onSend}
          disabled={!canSend}
          aria-label="Send"
        >
          <Send />
        </Button>
      </div>
      <div className="flex justify-end">
        <span
          className={cn(
            "text-[10px]",
            charCount > max ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {charCount}/{max}
        </span>
      </div>
    </div>
  )
}
