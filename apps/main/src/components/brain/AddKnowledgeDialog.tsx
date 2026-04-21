"use client"

import { useRef } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  FileText,
  Globe,
  StickyNote,
  ImageIcon,
  Upload,
} from "lucide-react"

import type { KnowledgeType, AgentSlug } from "@/lib/types"
import { AGENTS } from "@/lib/config/agents"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { FONT } from "@/components/veqiro/shared"

interface AddKnowledgeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (input: {
    type: KnowledgeType
    title: string
    content: string
    fileName?: string
    fileSize?: number
    agentAccess?: AgentSlug[]
  }) => void
}

const typeOptions: {
  value: KnowledgeType
  label: string
  icon: typeof FileText
}[] = [
  { value: "document", label: "Document", icon: FileText },
  { value: "webpage", label: "Webpage", icon: Globe },
  { value: "note", label: "Note", icon: StickyNote },
  { value: "image", label: "Image", icon: ImageIcon },
]

const allAgentIds = AGENTS.map((a) => a.id)

const formSchema = z
  .object({
    type: z.enum(["document", "webpage", "note", "image"]),
    title: z.string().min(1, "Title is required"),
    content: z.string(),
    fileName: z.string().optional(),
    fileSize: z.number().optional(),
    agentAccess: z.array(z.enum(["maya", "rex", "scout", "sage", "lex", "vega"])),
  })
  .refine(
    (data) => {
      if (data.type === "note" || data.type === "webpage") {
        return data.content.length > 0
      }
      return true
    },
    {
      message: "Content is required",
      path: ["content"],
    }
  )

type FormValues = z.infer<typeof formSchema>

export function AddKnowledgeDialog({
  open,
  onOpenChange,
  onAdd,
}: AddKnowledgeDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "note",
      title: "",
      content: "",
      fileName: undefined,
      fileSize: undefined,
      agentAccess: [...allAgentIds],
    },
  })

  const selectedType = form.watch("type")

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    form.setValue("fileName", file.name)
    form.setValue("fileSize", file.size)
    form.setValue("content", file.name)
    if (!form.getValues("title")) {
      form.setValue("title", file.name.replace(/\.[^/.]+$/, ""))
    }
  }

  const onSubmit = (data: FormValues) => {
    onAdd({
      type: data.type,
      title: data.title,
      content: data.content,
      fileName: data.fileName,
      fileSize: data.fileSize,
      agentAccess: data.agentAccess as AgentSlug[],
    })
    form.reset()
    onOpenChange(false)
  }

  const handleTypeChange = (type: KnowledgeType) => {
    form.setValue("type", type)
    form.setValue("content", "")
    form.setValue("fileName", undefined)
    form.setValue("fileSize", undefined)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: FONT.display, fontSize: 28, letterSpacing: -0.5, color: "#111" }}>
            add knowledge
          </DialogTitle>
          <DialogDescription style={{ fontFamily: FONT.body, fontSize: 14, color: "#555" }}>
            Add a new piece of knowledge to your brain.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          {/* Type selector */}
          <div className="flex gap-1.5">
            {typeOptions.map((opt) => {
              const Icon = opt.icon
              const isActive = selectedType === opt.value
              return (
                <Button
                  key={opt.value}
                  type="button"
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={() => handleTypeChange(opt.value)}
                >
                  <Icon className="size-3.5" />
                  {opt.label}
                </Button>
              )
            })}
          </div>

          <FieldGroup>
            {/* Title */}
            <Controller
              name="title"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="knowledge-title">Title</FieldLabel>
                  <Input
                    {...field}
                    id="knowledge-title"
                    placeholder="Give it a name..."
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            {/* Content area — varies by type */}
            {selectedType === "note" && (
              <Controller
                name="content"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="knowledge-content">Content</FieldLabel>
                    <Textarea
                      {...field}
                      id="knowledge-content"
                      placeholder="Write your note..."
                      className="min-h-24"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            )}

            {selectedType === "webpage" && (
              <Controller
                name="content"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="knowledge-url">URL</FieldLabel>
                    <div className="relative">
                      <Globe className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        {...field}
                        id="knowledge-url"
                        placeholder="https://example.com"
                        className="pl-7"
                        aria-invalid={fieldState.invalid}
                      />
                    </div>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            )}

            {selectedType === "document" && (
              <Field>
                <FieldLabel>File</FieldLabel>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 rounded-none border border-dashed border-input px-4 py-6 text-center transition-colors hover:bg-muted/50"
                >
                  <Upload className="size-5 text-muted-foreground" />
                  <div className="flex flex-col gap-0.5">
                    <p className="text-xs font-medium">
                      {form.watch("fileName") || "Click to upload or drag & drop"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      PDF, DOC, DOCX
                    </p>
                  </div>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </Field>
            )}

            {selectedType === "image" && (
              <Field>
                <FieldLabel>Image</FieldLabel>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 rounded-none border border-dashed border-input px-4 py-6 text-center transition-colors hover:bg-muted/50"
                >
                  <ImageIcon className="size-5 text-muted-foreground" />
                  <div className="flex flex-col gap-0.5">
                    <p className="text-xs font-medium">
                      {form.watch("fileName") || "Click to upload or drag & drop"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      PNG, JPG, JPEG, WEBP
                    </p>
                  </div>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </Field>
            )}
          </FieldGroup>

          {/* Agent access */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium">Which agents can use this?</p>
            <div className="flex flex-wrap gap-3">
              {AGENTS.map((agent) => (
                <Controller
                  key={agent.id}
                  name="agentAccess"
                  control={form.control}
                  render={({ field }) => {
                    const checked = field.value.includes(agent.id)
                    return (
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(val) => {
                            if (val) {
                              field.onChange([...field.value, agent.id])
                            } else {
                              field.onChange(
                                field.value.filter((id: string) => id !== agent.id)
                              )
                            }
                          }}
                        />
                        {agent.name}
                      </label>
                    )
                  }}
                />
              ))}
            </div>
          </div>

          {/* Footer */}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Add Knowledge</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
