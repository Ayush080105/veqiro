"use client"

import * as React from "react"
import {
  FileText,
  ExternalLink,
  ShieldAlert,
  MessageCircleQuestion,
  Trash2,
  Upload,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useLexSources, useDeleteLexSource } from "@/lib/api/lex"
import type { LexSource } from "@/lib/types/agents"

function fmtBytes(n: number): string {
  if (!n) return "—"
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return iso
  }
}

export function LexDocumentsTab({
  onUpload,
  onAnalyze,
  onQuery,
}: {
  onUpload: () => void
  onAnalyze: (source: LexSource) => void
  onQuery: (source: LexSource) => void
}) {
  const { data: sources, isLoading, error } = useLexSources()
  const deleteMut = useDeleteLexSource()
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null)

  const confirming = sources?.find((s) => s.id === confirmingId) ?? null

  const handleDelete = async () => {
    if (!confirming) return
    const id = confirming.id
    setConfirmingId(null)
    try {
      await deleteMut.mutateAsync(id)
      toast.success(`Deleted "${confirming.name}"`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete")
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Loading documents…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-destructive">
        Failed to load documents.
      </div>
    )
  }

  if (!sources || sources.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <div className="grid size-14 place-items-center rounded-full border border-border bg-muted/30">
          <FileText className="size-6 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">No documents yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Upload a PDF and Lex will index it for analysis and Q&amp;A.
          </p>
        </div>
        <Button onClick={onUpload} className="mt-2" size="sm">
          <Upload data-icon="inline-start" /> Upload your first document
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Uploaded documents</p>
          <p className="text-xs text-muted-foreground">
            {sources.length} document{sources.length === 1 ? "" : "s"} indexed
            for Lex.
          </p>
        </div>
        <Button onClick={onUpload} size="sm">
          <Upload data-icon="inline-start" /> Upload PDF
        </Button>
      </div>

      <div className="border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Pages</TableHead>
              <TableHead className="text-right">Size</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="max-w-[280px]">
                  <div className="flex items-center gap-2">
                    <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate text-xs font-medium" title={s.name}>
                      {s.name}
                    </span>
                  </div>
                  {s.summary && (
                    <p
                      className="mt-1 line-clamp-2 text-[10px] leading-snug text-muted-foreground"
                      title={s.summary}
                    >
                      {s.summary}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {s.typeDetected || s.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {s.pageCount}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {fmtBytes(s.sizeBytes)}
                </TableCell>
                <TableCell className="text-xs">{fmtDate(s.createdAt)}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => onAnalyze(s)}
                      title="Analyze contract"
                    >
                      <ShieldAlert data-icon="inline-start" /> Analyze
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => onQuery(s)}
                      title="Ask a question"
                    >
                      <MessageCircleQuestion data-icon="inline-start" /> Ask
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      asChild
                      title="Open PDF"
                    >
                      <a href={s.r2Url} target="_blank" rel="noreferrer">
                        <ExternalLink className="size-3" />
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => setConfirmingId(s.id)}
                      title="Delete document"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={!!confirming}
        onOpenChange={(v) => !v && setConfirmingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this document?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirming
                ? `"${confirming.name}" will be removed from R2, the RAG index, and your library. This cannot be undone.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
