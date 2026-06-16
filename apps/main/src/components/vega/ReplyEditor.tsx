"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send, X, Loader2 } from "lucide-react"

interface ReplyEditorProps {
  initialDraft: string | null
  onSend: (body: string) => Promise<void>
  onDiscard: () => void
}

export function ReplyEditor({ initialDraft, onSend, onDiscard }: ReplyEditorProps) {
  const [body, setBody] = useState(initialDraft ?? "")
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    if (!body.trim() || sending) return
    setSending(true)
    try {
      await onSend(body.trim())
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your reply..."
        rows={8}
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          border: "2px solid #111",
          borderRadius: 8,
          resize: "vertical",
        }}
      />
      <div className="flex items-center gap-2">
        <Button
          onClick={handleSend}
          disabled={!body.trim() || sending}
          style={{ border: "2px solid #111", boxShadow: "2px 2px 0 #111" }}
          size="sm"
        >
          {sending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Send className="size-3.5" />
          )}
          {sending ? "Sending..." : "Send Reply"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDiscard} disabled={sending}>
          <X className="size-3.5" />
          Discard
        </Button>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {body.length} chars
        </span>
      </div>
    </div>
  )
}
