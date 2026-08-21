"use client"

import { useState } from "react"
import { PlaysSection } from "@/components/tasks/PlaysSection"
import { TriggersSection } from "@/components/tasks/TriggersSection"
import cronstrue from "cronstrue"
import {
  Clock,
  Edit2,
  Play,
  Trash2,
} from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TaskEditSheet } from "@/components/tasks/TaskEditSheet"
import { useTasks, useUpdateTask, useDeleteTask, useRunTask, type Task, type AgentSlug } from "@/lib/api/tasks"
import { FONT } from "@/lib/fonts"
import { toast } from "sonner"

// ─── Agent config ─────────────────────────────────────────────────────────────

const AGENT_CONFIG: Record<AgentSlug, { label: string; color: string; bg: string }> = {
  REX:   { label: "Rex",   color: "#111", bg: "#1DBC87" },
  VEGA:  { label: "Vega",  color: "#111", bg: "#6FCDE8" },
  MAYA:  { label: "Maya",  color: "#fff", bg: "#F06464" },
  SAGE:  { label: "Sage",  color: "#111", bg: "#F79FD4" },
  LEX:   { label: "Lex",   color: "#fff", bg: "#8A8AF0" },
  SCOUT: { label: "Scout", color: "#111", bg: "#F5C518" },
}

function agentBadge(agent: AgentSlug) {
  const cfg = AGENT_CONFIG[agent]
  return (
    <span
      style={{
        fontFamily: FONT.mono,
        fontSize: 9,
        letterSpacing: 1.5,
        textTransform: "uppercase",
        padding: "2px 7px",
        borderRadius: 999,
        border: "1.5px solid #111",
        background: cfg.bg,
        color: cfg.color,
      }}
    >
      {cfg.label}
    </span>
  )
}

function describeSchedule(task: Task): string {
  if (!task.cronExpression) return "No schedule"
  try {
    return cronstrue.toString(task.cronExpression, { verbose: false })
  } catch {
    return task.cronExpression
  }
}

function formatRelative(dateStr: string | null): string {
  if (!dateStr) return "Never"
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  onEdit,
  onToggle,
  onDelete,
  onRun,
}: {
  task: Task
  onEdit: (t: Task) => void
  onToggle: (t: Task, enabled: boolean) => void
  onDelete: (t: Task) => void
  onRun: (t: Task) => void
}) {
  return (
    <Card
      style={{
        border: "2px solid #111",
        borderRadius: 10,
        boxShadow: "2px 2px 0 #111",
        opacity: task.isEnabled ? 1 : 0.6,
      }}
    >
      <CardContent className="flex items-start gap-3 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span style={{ fontFamily: FONT.head, fontSize: 14, color: "#111" }}>{task.name}</span>
            {task.agent && agentBadge(task.agent)}
            {task.isDefault && (
              <span style={{ fontFamily: FONT.mono, fontSize: 9, color: "#888", letterSpacing: 1 }}>DEFAULT</span>
            )}
          </div>
          {task.description && (
            <p style={{ fontFamily: FONT.mono, fontSize: 11, color: "#555", marginBottom: 6 }}>
              {task.description}
            </p>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <span style={{ fontFamily: FONT.mono, fontSize: 10, color: "#777", display: "flex", alignItems: "center", gap: 4 }}>
              <Clock size={11} />
              {describeSchedule(task)}
            </span>
            {task.lastRunAt && (
              <span style={{ fontFamily: FONT.mono, fontSize: 10, color: "#aaa" }}>
                Last: {formatRelative(task.lastRunAt)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Switch
            checked={task.isEnabled}
            onCheckedChange={(v) => onToggle(task, v)}
          />
          {task.type === "AGENT" && (
            <button
              onClick={() => onRun(task)}
              title="Run now"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#555" }}
            >
              <Play size={14} />
            </button>
          )}
          <button
            onClick={() => onEdit(task)}
            title="Edit"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#555" }}
          >
            <Edit2 size={14} />
          </button>
          {!task.isDefault && (
            <button
              onClick={() => onDelete(task)}
              title="Delete"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#F06464" }}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const { data: allTasks, isLoading } = useTasks()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const runTask = useRunTask()

  const [editingTask, setEditingTask] = useState<Task | null>(null)

  const agentTasks = allTasks?.filter((t) => t.type === "AGENT") ?? []
  const generalTasks = allTasks?.filter((t) => t.type === "GENERAL") ?? []

  const grouped = agentTasks.reduce<Record<string, Task[]>>((acc, t) => {
    const key = t.agent ?? "OTHER"
    if (!acc[key]) acc[key] = []
    acc[key]!.push(t)
    return acc
  }, {})

  const handleToggle = (task: Task, enabled: boolean) => {
    updateTask.mutate(
      { id: task.id, isEnabled: enabled },
      { onError: (err) => toast.error(err.message) }
    )
  }

  const handleDelete = (task: Task) => {
    if (!confirm(`Delete "${task.name}"?`)) return
    deleteTask.mutate(task.id, {
      onSuccess: () => toast.success("Task deleted"),
      onError: (err) => toast.error(err.message),
    })
  }

  const handleRun = (task: Task) => {
    runTask.mutate(task.id, {
      onSuccess: () => toast.success("Task triggered"),
      onError: (err) => toast.error(err.message),
    })
  }

  return (
    <div className="flex min-w-0 flex-col gap-6 pb-10">
      <PageHeader
        title="Tasks"
        subtitle="Manage scheduled operations across your workspace."
      />

      <Tabs defaultValue="agent">
        <div className="flex items-center justify-between gap-4 mb-4">
          <TabsList className="border-2 border-foreground bg-transparent h-9">
            <TabsTrigger
              value="agent"
              style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: 1 }}
            >
              AGENT TASKS
            </TabsTrigger>
            <TabsTrigger
              value="general"
              style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: 1 }}
            >
              GENERAL
            </TabsTrigger>
            <TabsTrigger
              value="recurring"
              style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: 1 }}
            >
              RECURRING
            </TabsTrigger>
            <TabsTrigger
              value="triggers"
              style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: 1 }}
            >
              TRIGGERS
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="agent" className="mt-0">
          {isLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          ) : agentTasks.length === 0 ? (
            <p style={{ fontFamily: FONT.mono, fontSize: 12, color: "#888" }}>
              No agent tasks yet.
            </p>
          ) : (
            <div className="flex flex-col gap-8">
              {Object.entries(grouped).map(([agent, tasks]) => (
                <div key={agent} className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    {agentBadge(agent as AgentSlug)}
                    <span style={{ fontFamily: FONT.mono, fontSize: 10, color: "#888", letterSpacing: 1 }}>
                      {tasks.length} TASK{tasks.length !== 1 ? "S" : ""}
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {tasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onEdit={setEditingTask}
                        onToggle={handleToggle}
                        onDelete={handleDelete}
                        onRun={handleRun}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="general" className="mt-0">
          {isLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : generalTasks.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Clock size={28} style={{ color: "#ccc" }} />
              <p style={{ fontFamily: FONT.head, fontSize: 15, color: "#555" }}>No general tasks yet</p>
              <p style={{ fontFamily: FONT.mono, fontSize: 11, color: "#888" }}>
                General tasks will appear here once created.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {generalTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onEdit={setEditingTask}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  onRun={handleRun}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Scheduled and event-driven work both live here rather than in
            settings: this page is where the workspace's recurring operations
            already are, and these are the same kind of thing. */}
        <TabsContent value="recurring" className="mt-0">
          <PlaysSection />
        </TabsContent>

        <TabsContent value="triggers" className="mt-0">
          <TriggersSection />
        </TabsContent>
      </Tabs>

      <TaskEditSheet
        task={editingTask}
        open={!!editingTask}
        onClose={() => setEditingTask(null)}
      />
    </div>
  )
}
