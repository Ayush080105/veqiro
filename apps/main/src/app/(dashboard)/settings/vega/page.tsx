"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { authClient } from "@/lib/auth-client"
import { qk } from "@/lib/query-keys"
import {
  fetchVIPContacts,
  addVIPContact,
  removeVIPContact,
  type VIPContact,
} from "@/lib/api/vega-vip"
import {
  fetchLabels,
  createLabel,
  deleteLabel,
  updateLabel,
  type VegaLabel,
} from "@/lib/api/vega-labels"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Star, Trash2, Plus, AlertCircle, Tag } from "lucide-react"
import { toast } from "sonner"
import { SettingsNav } from "@/components/settings/SettingsNav"

const inputStyle: React.CSSProperties = {
  padding: "7px 10px",
  border: "1.5px solid #111",
  borderRadius: 6,
  fontSize: 12,
  fontFamily: "var(--font-mono)",
  background: "#fff",
  outline: "none",
}

export default function VegaSettingsPage() {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""
  const queryClient = useQueryClient()

  // ── VIP Contacts state ────────────────────────────────────────────────────
  const [vipEmail, setVipEmail] = useState("")
  const [vipName, setVipName] = useState("")

  const { data: contacts, isLoading: vipLoading, isError: vipError } = useQuery({
    queryKey: qk.vegaVIPContacts(organizationId),
    queryFn: fetchVIPContacts,
    enabled: !!organizationId,
  })

  const addVIPMutation = useMutation({
    mutationFn: addVIPContact,
    onSuccess: () => {
      toast.success("VIP contact added")
      setVipEmail("")
      setVipName("")
      queryClient.invalidateQueries({ queryKey: qk.vegaVIPContacts(organizationId) })
    },
    onError: () => toast.error("Failed to add VIP contact"),
  })

  const removeVIPMutation = useMutation({
    mutationFn: removeVIPContact,
    onSuccess: () => {
      toast.success("VIP contact removed")
      queryClient.invalidateQueries({ queryKey: qk.vegaVIPContacts(organizationId) })
    },
    onError: () => toast.error("Failed to remove VIP contact"),
  })

  const handleAddVIP = () => {
    const trimmedEmail = vipEmail.trim()
    if (!trimmedEmail) { toast.error("Email is required"); return }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(trimmedEmail)) { toast.error("Please enter a valid email address"); return }
    addVIPMutation.mutate({ email: trimmedEmail, name: vipName.trim() || undefined })
  }

  // ── Labels state ──────────────────────────────────────────────────────────
  const [labelName, setLabelName] = useState("")
  const [labelColor, setLabelColor] = useState("#1DBC87")
  const [labelRationale, setLabelRationale] = useState("")

  const { data: labels, isLoading: labelsLoading, isError: labelsError } = useQuery({
    queryKey: qk.vegaLabels(organizationId),
    queryFn: fetchLabels,
    enabled: !!organizationId,
  })

  const createLabelMutation = useMutation({
    mutationFn: createLabel,
    onSuccess: () => {
      toast.success("Label created")
      setLabelName("")
      setLabelColor("#1DBC87")
      setLabelRationale("")
      queryClient.invalidateQueries({ queryKey: qk.vegaLabels(organizationId) })
      queryClient.invalidateQueries({ queryKey: qk.vegaInbox(organizationId) })
    },
    onError: () => toast.error("Failed to create label"),
  })

  const deleteLabelMutation = useMutation({
    mutationFn: deleteLabel,
    onSuccess: () => {
      toast.success("Label deleted")
      queryClient.invalidateQueries({ queryKey: qk.vegaLabels(organizationId) })
      queryClient.invalidateQueries({ queryKey: qk.vegaInbox(organizationId) })
    },
    onError: () => toast.error("Failed to delete label"),
  })

  const updateLabelMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { autoReply?: boolean; color?: string; rationale?: string } }) =>
      updateLabel(id, data),
    onMutate: async ({ id, data }) => {
      const queryKey = qk.vegaLabels(organizationId)
      await queryClient.cancelQueries({ queryKey })
      const previousLabels = queryClient.getQueryData<VegaLabel[]>(queryKey)
      queryClient.setQueryData<VegaLabel[]>(queryKey, (current) =>
        current?.map((label) =>
          label.id === id ? { ...label, ...data } : label
        ) ?? current
      )
      return { previousLabels }
    },
    onSuccess: (updatedLabel) => {
      queryClient.setQueryData<VegaLabel[]>(qk.vegaLabels(organizationId), (current) =>
        current?.map((label) =>
          label.id === updatedLabel.id ? updatedLabel : label
        ) ?? current
      )
    },
    onError: (_err, _variables, context) => {
      if (context?.previousLabels) {
        queryClient.setQueryData(qk.vegaLabels(organizationId), context.previousLabels)
      }
      toast.error("Failed to update label")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.vegaLabels(organizationId) })
      queryClient.invalidateQueries({ queryKey: qk.vegaInbox(organizationId) })
    },
  })

  const handleAddLabel = () => {
    const name = labelName.trim()
    if (!name) { toast.error("Label name is required"); return }
    createLabelMutation.mutate({ name, color: labelColor, rationale: labelRationale.trim() })
  }

  return (
    <div className="flex w-full flex-col gap-6 pb-8">
      <PageHeader
        kicker="preferences"
        title="email settings"
        subtitle="Configure how Vega classifies and prioritizes your inbox."
        sticker={{ label: "mail rules", rot: -2, color: "#E8F4FD" }}
      />

      <SettingsNav />
      <div className="grid w-full gap-6 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
      {/* ── VIP Contacts ── */}
      <section className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">VIP contacts</h2>
          <p className="text-xs text-muted-foreground">
            Emails from VIP contacts are always surfaced at the top of your inbox, regardless of AI triage priority.
          </p>
        </div>

        <div
          className="flex min-w-0 flex-col gap-3 overflow-hidden p-4 rounded-xl"
          style={{ border: "2px solid #111", boxShadow: "3px 3px 0 #111", background: "#FFF9ED" }}
        >
          <span
            className="text-xs font-semibold"
            style={{ fontFamily: "var(--font-mono)", letterSpacing: 1, textTransform: "uppercase" }}
          >
            Add VIP Contact
          </span>
          <div className="flex flex-col gap-2">
            <input
              style={{ ...inputStyle, width: "100%" }}
              placeholder="email@example.com"
              value={vipEmail}
              onChange={(e) => setVipEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddVIP() } }}
            />
            <input
              style={{ ...inputStyle, width: "100%" }}
              placeholder="Name (optional)"
              value={vipName}
              onChange={(e) => setVipName(e.target.value)}
            />
            <Button
              onClick={handleAddVIP}
              disabled={addVIPMutation.isPending}
              size="sm"
              className="w-full justify-center sm:w-fit"
              style={{ border: "2px solid #111", boxShadow: "2px 2px 0 #111" }}
            >
              <Plus className="size-3.5" />
              Add
            </Button>
          </div>
        </div>

        {vipLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : vipError ? (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="size-4" />
            Could not load VIP contacts
          </div>
        ) : contacts && contacts.length > 0 ? (
          <div className="flex flex-col gap-2">
            {contacts.map((contact: VIPContact) => (
              <div
                key={contact.id}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg"
                style={{ border: "1.5px solid #E5E5E5", background: "#fff" }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Star className="size-3.5 shrink-0 fill-current" style={{ color: "#F5C518" }} />
                  <div className="flex flex-col min-w-0">
                    {contact.name && (
                      <span className="text-xs font-semibold truncate">{contact.name}</span>
                    )}
                    <span className="text-xs text-muted-foreground truncate" style={{ fontFamily: "var(--font-mono)" }}>
                      {contact.email}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => removeVIPMutation.mutate(contact.id)}
                  disabled={removeVIPMutation.isPending}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
            <Star className="size-8 opacity-20" />
            <p className="text-sm">No VIP contacts yet</p>
            <p className="text-xs text-center max-w-xs">
              Add email addresses above — Vega will always put their messages at the top of your inbox.
            </p>
          </div>
        )}
      </section>

      {/* ── Labels ── */}
      <section className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">Email labels</h2>
          <p className="text-xs text-muted-foreground">
            Vega uses these labels and rationales to classify incoming emails.
          </p>
        </div>

        <div
          className="flex min-w-0 flex-col gap-3 overflow-hidden p-4 rounded-xl"
          style={{ border: "2px solid #111", boxShadow: "3px 3px 0 #111", background: "#FFF9ED" }}
        >
          <span
            className="text-xs font-semibold"
            style={{ fontFamily: "var(--font-mono)", letterSpacing: 1, textTransform: "uppercase" }}
          >
            Add Label
          </span>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              style={{ ...inputStyle, flex: 1 }}
              placeholder="Label name"
              value={labelName}
              onChange={(e) => setLabelName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddLabel() } }}
            />
            <div className="flex items-center gap-1.5 shrink-0">
              <input
                type="color"
                value={labelColor}
                onChange={(e) => setLabelColor(e.target.value)}
                style={{
                  width: 32,
                  height: 32,
                  border: "1.5px solid #111",
                  borderRadius: 6,
                  padding: 2,
                  cursor: "pointer",
                  background: "#fff",
                }}
                title="Pick label color"
              />
            </div>
            <Button
              onClick={handleAddLabel}
              disabled={createLabelMutation.isPending}
              size="sm"
              style={{ border: "2px solid #111", boxShadow: "2px 2px 0 #111" }}
            >
              <Plus className="size-3.5" />
              Add
            </Button>
          </div>
          <textarea
            style={{ ...inputStyle, minHeight: 72, resize: "vertical" }}
            placeholder="Why Vega should use this label"
            value={labelRationale}
            onChange={(e) => setLabelRationale(e.target.value)}
          />
        </div>

        {labelsLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : labelsError ? (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="size-4" />
            Could not load labels
          </div>
        ) : labels && labels.length > 0 ? (
          <div className="flex flex-col gap-2">
            {labels.map((label: VegaLabel) => (
              <div
                key={label.id}
                className="flex flex-col gap-3 px-4 py-3 rounded-lg"
                style={{ border: "1.5px solid #E5E5E5", background: "#fff" }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <input
                      type="color"
                      value={label.color}
                      onChange={(e) =>
                        updateLabelMutation.mutate({ id: label.id, data: { color: e.target.value } })
                      }
                      style={{
                        width: 24,
                        height: 24,
                        border: "1.5px solid rgba(0,0,0,0.2)",
                        borderRadius: 6,
                        padding: 2,
                        cursor: "pointer",
                        background: "#fff",
                        flexShrink: 0,
                      }}
                      title="Pick label color"
                    />
                    <span className="text-xs font-semibold truncate">{label.name}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-xs text-muted-foreground"
                        style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}
                      >
                        Auto-draft
                      </span>
                      <Switch
                        checked={label.autoReply}
                        onCheckedChange={(checked) =>
                          updateLabelMutation.mutate({ id: label.id, data: { autoReply: checked } })
                        }
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive hover:text-destructive"
                      onClick={() => deleteLabelMutation.mutate(label.id)}
                      disabled={deleteLabelMutation.isPending}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
                <textarea
                  key={`${label.id}:${label.rationale}`}
                  style={{ ...inputStyle, width: "100%", minHeight: 68, resize: "vertical" }}
                  defaultValue={label.rationale}
                  placeholder="Why Vega should use this label"
                  onBlur={(e) => {
                    const rationale = e.currentTarget.value.trim()
                    if (rationale !== label.rationale) {
                      updateLabelMutation.mutate({ id: label.id, data: { rationale } })
                    }
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
            <Tag className="size-8 opacity-20" />
            <p className="text-sm">No labels yet</p>
            <p className="text-xs text-center max-w-xs">
              Add a label above — Vega will use your labels to classify incoming emails.
            </p>
          </div>
        )}
      </section>
      </div>
    </div>
  )
}
