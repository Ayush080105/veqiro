"use client"

import { FileText, Globe, StickyNote, ImageIcon, Trash2 } from "lucide-react"

import type { KnowledgeItem, KnowledgeType } from "@/lib/types"
import { AGENTS } from "@/lib/config/agents"
import { FONT } from "@/components/veqiro/shared"

interface KnowledgeCardProps {
  item: KnowledgeItem
  onDelete: (id: string) => void
}

const typeConfig: Record<
  KnowledgeType,
  { icon: typeof FileText; label: string; color: string }
> = {
  document: { icon: FileText, label: "Document", color: "var(--vq-blue)" },
  webpage: { icon: Globe, label: "Webpage", color: "var(--vq-green)" },
  note: { icon: StickyNote, label: "Note", color: "var(--vq-yellow)" },
  image: { icon: ImageIcon, label: "Image", color: "var(--vq-pink)" },
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  const diff = now - date

  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return "just now"

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`

  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

export function KnowledgeCard({ item, onDelete }: KnowledgeCardProps) {
  const config = typeConfig[item.type]
  const Icon = config.icon

  const accessAgents = AGENTS.filter((a) => item.agentAccess.includes(a.id))

  return (
    <div
      style={{
        position: "relative",
        background: "#FFF9ED",
        border: "3px solid #111",
        borderRadius: 14,
        boxShadow: `5px 5px 0 ${config.color}`,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "3px 10px",
            background: config.color,
            border: "2px solid #111",
            borderRadius: 999,
            fontFamily: FONT.mono,
            fontSize: 10,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: "#111",
          }}
        >
          <Icon className="size-3" /> {config.label}
        </span>
        <button
          type="button"
          onClick={() => onDelete(item.id)}
          title="Delete"
          style={{
            background: "transparent",
            border: "none",
            color: "#7A1717",
            padding: 4,
            cursor: "pointer",
          }}
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <div>
        <p
          style={{
            fontFamily: FONT.head,
            fontSize: 14,
            color: "#111",
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          {item.title}
        </p>
        <p
          style={{
            fontFamily: FONT.body,
            fontSize: 13,
            lineHeight: 1.4,
            color: "#555",
            margin: "6px 0 0",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {item.content}
        </p>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 4,
        }}
      >
        <div style={{ display: "flex" }}>
          {accessAgents.map((agent, i) => (
            <span
              key={agent.id}
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: agent.color,
                border: "1.5px solid #111",
                display: "grid",
                placeItems: "center",
                fontFamily: FONT.head,
                fontSize: 9,
                color: "#111",
                marginLeft: i === 0 ? 0 : -6,
              }}
              title={agent.name}
            >
              {agent.initials}
            </span>
          ))}
        </div>
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 10,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: "#555",
          }}
        >
          {formatRelativeTime(item.updatedAt)}
        </span>
      </div>
    </div>
  )
}
