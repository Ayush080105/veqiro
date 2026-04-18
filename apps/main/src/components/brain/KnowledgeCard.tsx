"use client"

import { FileText, Globe, StickyNote, ImageIcon, Trash2 } from "lucide-react"

import type { KnowledgeItem, KnowledgeType } from "@/lib/types"
import { AGENTS } from "@/lib/config/agents"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface KnowledgeCardProps {
  item: KnowledgeItem
  onDelete: (id: string) => void
}

const typeConfig: Record<
  KnowledgeType,
  { icon: typeof FileText; label: string }
> = {
  document: { icon: FileText, label: "Document" },
  webpage: { icon: Globe, label: "Webpage" },
  note: { icon: StickyNote, label: "Note" },
  image: { icon: ImageIcon, label: "Image" },
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  const diff = now - date

  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return "just now"

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days > 1 ? "s" : ""} ago`

  const months = Math.floor(days / 30)
  return `${months} month${months > 1 ? "s" : ""} ago`
}

export function KnowledgeCard({ item, onDelete }: KnowledgeCardProps) {
  const config = typeConfig[item.type]
  const Icon = config.icon

  const accessAgents = AGENTS.filter((a) => item.agentAccess.includes(a.id))

  return (
    <Card className="group relative transition-colors hover:bg-muted/30">
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Icon className="size-4 text-muted-foreground" />
            <Badge variant="secondary">{config.label}</Badge>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(item.id)}
          >
            <Trash2 className="size-3.5" />
            <span className="sr-only">Delete</span>
          </Button>
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium leading-snug">{item.title}</p>
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {item.content}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex -space-x-1.5">
            {accessAgents.map((agent) => (
              <Avatar key={agent.id} size="sm" className="size-5 ring-2 ring-background">
                <AvatarFallback className="text-[9px]">
                  {agent.initials}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {formatRelativeTime(item.updatedAt)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
