"use client"

import Link from "next/link"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { AgentConfig, AgentStatus } from "@/lib/types"

interface AssistantCardProps {
  agent: AgentConfig
  status?: AgentStatus
  lastActivity?: string
}

function StatusDot({ status, lastActivity }: { status?: AgentStatus; lastActivity?: string }) {
  if (status === "working") {
    return (
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-chart-2 shrink-0" />
        <span className="text-xs text-muted-foreground">Currently working...</span>
      </div>
    )
  }
  if (status === "needs-attention") {
    return (
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-destructive shrink-0" />
        <span className="text-xs text-muted-foreground">Needs attention</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-full bg-chart-1 shrink-0" />
      <span className="text-xs text-muted-foreground">{lastActivity ?? "Ready"}</span>
    </div>
  )
}

export function AssistantCard({ agent, status, lastActivity }: AssistantCardProps) {
  return (
    <Link href={`/assistants/${agent.id}`} className="block h-full">
      <Card className="h-full cursor-pointer hover:ring-foreground/20 transition-all">
        <CardHeader className="border-b border-border">
          <div className="flex items-start gap-3">
            <Avatar size="lg" className="size-12 text-sm font-semibold">
              <AvatarFallback>{agent.initials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-sm font-semibold text-foreground leading-none">{agent.name}</span>
              <Badge variant="secondary" className="w-fit text-xs">{agent.role}</Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-3 pt-3">
          <StatusDot status={status} lastActivity={lastActivity} />

          <p className="text-muted-foreground text-xs leading-relaxed line-clamp-2">
            {agent.description}
          </p>

          <div className="flex flex-wrap gap-1">
            {agent.specialties.map((specialty) => (
              <Badge key={specialty} variant="outline">
                {specialty}
              </Badge>
            ))}
          </div>

        </CardContent>

        <CardFooter>
          <Button className="w-full" size="sm">
            Chat
          </Button>
        </CardFooter>
      </Card>
    </Link>
  )
}
