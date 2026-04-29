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
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Star, Trash2, Plus, AlertCircle } from "lucide-react"
import { toast } from "sonner"

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

  const [email, setEmail] = useState("")
  const [name, setName] = useState("")

  const { data: contacts, isLoading, isError } = useQuery({
    queryKey: qk.vegaVIPContacts(organizationId),
    queryFn: fetchVIPContacts,
    enabled: !!organizationId,
  })

  const addMutation = useMutation({
    mutationFn: addVIPContact,
    onSuccess: () => {
      toast.success("VIP contact added")
      setEmail("")
      setName("")
      queryClient.invalidateQueries({ queryKey: qk.vegaVIPContacts(organizationId) })
    },
    onError: () => toast.error("Failed to add VIP contact"),
  })

  const removeMutation = useMutation({
    mutationFn: removeVIPContact,
    onSuccess: () => {
      toast.success("VIP contact removed")
      queryClient.invalidateQueries({ queryKey: qk.vegaVIPContacts(organizationId) })
    },
    onError: () => toast.error("Failed to remove VIP contact"),
  })

  const handleAdd = () => {
    if (!email.trim()) {
      toast.error("Email is required")
      return
    }
    addMutation.mutate({ email: email.trim(), name: name.trim() || undefined })
  }

  return (
    <div className="flex flex-col gap-6 pb-8 max-w-2xl">
      <PageHeader
        kicker="vega"
        title="VIP contacts"
        subtitle="Emails from VIP contacts are always surfaced at the top of your inbox, regardless of AI triage priority."
        sticker={{ label: "VIPs", rot: 2, color: "var(--vq-yellow)" }}
      />

      {/* Add form */}
      <div
        className="flex flex-col gap-3 p-4 rounded-xl"
        style={{ border: "2px solid #111", boxShadow: "3px 3px 0 #111", background: "#FFF9ED" }}
      >
        <span
          className="text-xs font-semibold"
          style={{ fontFamily: "var(--font-mono)", letterSpacing: 1, textTransform: "uppercase" }}
        >
          Add VIP Contact
        </span>
        <div className="flex gap-2">
          <input
            style={{ ...inputStyle, flex: 2 }}
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleAdd()
              }
            }}
          />
          <input
            style={{ ...inputStyle, flex: 1 }}
            placeholder="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button
            onClick={handleAdd}
            disabled={addMutation.isPending}
            size="sm"
            style={{ border: "2px solid #111", boxShadow: "2px 2px 0 #111" }}
          >
            <Plus className="size-3.5" />
            Add
          </Button>
        </div>
      </div>

      {/* Contact list */}
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : isError ? (
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
                  <span
                    className="text-xs text-muted-foreground truncate"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {contact.email}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 text-destructive hover:text-destructive"
                onClick={() => removeMutation.mutate(contact.id)}
                disabled={removeMutation.isPending}
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
    </div>
  )
}
