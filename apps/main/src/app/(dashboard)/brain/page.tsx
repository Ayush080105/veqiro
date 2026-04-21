"use client"

import { useEffect, useRef, useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  Brain,
  Layers,
  FileText,
  Globe,
  StickyNote,
  ImageIcon,
} from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { getBrandKit, saveBrandKit, scrapeBrandKit } from "@/lib/api/brain"
import { useKnowledgeStore } from "@/hooks/useKnowledgeStore"
import type { BrandKit, KnowledgeType } from "@/lib/types"

import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

import { BrainSearch } from "@/components/brain/BrainSearch"
import { KnowledgeGrid } from "@/components/brain/KnowledgeGrid"
import { AddKnowledgeDialog } from "@/components/brain/AddKnowledgeDialog"
import { BrandKitSection } from "@/components/brain/BrandKitSection"
import { Button as VqButton, PageHeader, FONT } from "@/components/veqiro/shared"

// ─── Schema ────────────────────────────────────────────────────────────────────

const brainSchema = z.object({
  company_name: z.string().min(1, "Company name is required"),
  company_description: z.string(),
  website_url: z.string(),
  industry: z.string(),
  target_audience: z.string(),
  brand_voice: z.string(),
  platform_tones: z.object({
    twitter: z.string(),
    linkedin: z.string(),
    instagram: z.string(),
  }),
  brand_colors: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
  }),
  competitors: z.array(z.object({ value: z.string() })),
  key_differentiators: z.string(),
})

type BrainFormValues = z.infer<typeof brainSchema>

// ─── Default Values ────────────────────────────────────────────────────────────

const DEFAULT_VALUES: BrainFormValues = {
  company_name: "",
  company_description: "",
  website_url: "",
  industry: "",
  target_audience: "",
  brand_voice: "Professional",
  platform_tones: { twitter: "", linkedin: "", instagram: "" },
  brand_colors: { primary: "#000000", secondary: "#ffffff", accent: "#888888" },
  competitors: [],
  key_differentiators: "",
}

function brandKitToForm(kit: BrandKit): BrainFormValues {
  return {
    company_name: kit.company_name,
    company_description: kit.company_description,
    website_url: kit.website_url,
    industry: kit.industry,
    target_audience: kit.target_audience,
    brand_voice: kit.brand_voice,
    platform_tones: kit.platform_tones,
    brand_colors: kit.brand_colors,
    competitors: (kit.competitors ?? []).map((c) => ({ value: c })),
    key_differentiators: kit.key_differentiators,
  }
}

function formToBrandKit(values: BrainFormValues): Partial<BrandKit> {
  return {
    ...values,
    competitors: values.competitors.map((c) => c.value).filter(Boolean),
  }
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function BrainSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-full" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    </div>
  )
}

// ─── Tab filter config ─────────────────────────────────────────────────────────

const KNOWLEDGE_TABS: {
  value: string
  label: string
  icon: typeof Layers
  filterType?: KnowledgeType
}[] = [
  { value: "all", label: "All", icon: Layers },
  { value: "brand-kit", label: "Brand Kit", icon: Brain },
  { value: "documents", label: "Documents", icon: FileText, filterType: "document" },
  { value: "webpages", label: "Webpages", icon: Globe, filterType: "webpage" },
  { value: "notes", label: "Notes", icon: StickyNote, filterType: "note" },
  { value: "images", label: "Images", icon: ImageIcon, filterType: "image" },
]

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function BrainPage() {
  const { data: activeOrg } = authClient.useActiveOrganization()
  const organizationId = activeOrg?.id ?? ""

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [scraping, setScraping] = useState(false)
  const [hasPending, setHasPending] = useState(false)
  const [backendUnavailable, setBackendUnavailable] = useState(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("all")

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    control,
    handleSubmit,
    reset,
    getValues,
    formState: { errors },
  } = useForm<BrainFormValues>({
    resolver: zodResolver(brainSchema),
    defaultValues: DEFAULT_VALUES,
  })

  const { fields: competitorFields, append, remove } = useFieldArray({
    control,
    name: "competitors",
  })

  const knowledge = useKnowledgeStore(organizationId)

  // Load brand kit on mount
  useEffect(() => {
    if (!organizationId) return
    setLoading(true)
    getBrandKit(organizationId)
      .then((kit) => {
        if (kit) {
          reset(brandKitToForm(kit))
        } else {
          setBackendUnavailable(true)
        }
      })
      .catch(() => {
        setBackendUnavailable(true)
      })
      .finally(() => setLoading(false))
  }, [organizationId, reset])

  // Debounced auto-save
  const scheduleAutoSave = () => {
    setHasPending(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const values = getValues()
        const result = await saveBrandKit(organizationId, formToBrandKit(values))
        if (result.ok) {
          setHasPending(false)
        } else if (result.unavailable) {
          setBackendUnavailable(true)
          setHasPending(false)
        } else {
          toast.error("Auto-save failed")
        }
      } catch {
        toast.error("Auto-save failed")
      }
    }, 800)
  }

  const onSave = async (values: BrainFormValues) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSaving(true)
    try {
      const result = await saveBrandKit(organizationId, formToBrandKit(values))
      if (result.ok) {
        setHasPending(false)
        toast.success("Brain saved successfully")
      } else if (result.unavailable) {
        setBackendUnavailable(true)
        toast.info("Brain storage is being set up — your changes are saved locally")
      } else {
        toast.error("Failed to save Brain")
      }
    } finally {
      setSaving(false)
    }
  }

  const handleAutoFill = async () => {
    const url = getValues("website_url")
    if (!url) {
      toast.error("Enter a website URL first")
      return
    }
    setScraping(true)
    try {
      const scraped = await scrapeBrandKit(url, organizationId)
      const current = getValues()
      reset({
        ...current,
        ...Object.fromEntries(
          Object.entries(scraped).filter(
            ([, v]) => v !== undefined && v !== null && v !== ""
          )
        ),
        brand_colors: scraped.brand_colors ?? current.brand_colors,
        platform_tones: scraped.platform_tones ?? current.platform_tones,
        competitors: scraped.competitors
          ? scraped.competitors.map((c) => ({ value: c }))
          : current.competitors,
      } as BrainFormValues)
      toast.success("Auto-filled from URL")
    } catch {
      toast.error("Failed to scrape URL")
    } finally {
      setScraping(false)
    }
  }

  // Filter knowledge items
  const currentTabConfig = KNOWLEDGE_TABS.find((t) => t.value === activeTab)
  const filteredItems = currentTabConfig?.filterType
    ? knowledge.searchItems(searchQuery, currentTabConfig.filterType)
    : knowledge.searchItems(searchQuery)

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl pb-24">
        <div className="mb-6">
          <PageHeader kicker="knowledge base" title="brain" subtitle="Your AI team's central memory." />
        </div>
        <BrainSkeleton />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSave)} className="mx-auto max-w-4xl pb-24">
      {/* Header */}
      <div className="mb-6">
        <PageHeader
          kicker="knowledge base"
          title="brain"
          subtitle="Your AI team's central memory — everything they know about your company, brand, and business."
          right={
            <VqButton variant="dark" onClick={() => setAddDialogOpen(true)}>
              + Add Knowledge
            </VqButton>
          }
        />
      </div>

      {/* Backend unavailable notice */}
      {backendUnavailable && (
        <div
          style={{
            marginBottom: 16,
            background: 'var(--vq-yellow)',
            border: '2.5px solid #111',
            borderRadius: 10,
            boxShadow: '3px 3px 0 #111',
            padding: '10px 14px',
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: 1,
            color: '#111',
          }}
        >
          // Brain storage is being set up. You can still configure everything — data will sync once the backend is connected.
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <BrainSearch value={searchQuery} onChange={setSearchQuery} />
      </div>

      {/* Primary tabs */}
      <Tabs
        defaultValue="all"
        onValueChange={(v) => {
          setActiveTab(v as string)
          setSearchQuery("")
        }}
      >
        <TabsList variant="line" className="mb-4">
          {KNOWLEDGE_TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <TabsTrigger key={tab.value} value={tab.value}>
                <Icon className="size-3.5" />
                {tab.label}
              </TabsTrigger>
            )
          })}
        </TabsList>

        {/* All / category tabs — show knowledge grid */}
        {KNOWLEDGE_TABS.filter((t) => t.value !== "brand-kit").map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            <KnowledgeGrid
              items={filteredItems}
              onDelete={knowledge.removeItem}
            />
          </TabsContent>
        ))}

        {/* Brand Kit tab — show the form */}
        <TabsContent value="brand-kit">
          <BrandKitSection
            control={control}
            errors={errors}
            competitorFields={competitorFields}
            appendCompetitor={append}
            removeCompetitor={remove}
            scheduleAutoSave={scheduleAutoSave}
            getValues={getValues}
            scraping={scraping}
            onAutoFill={handleAutoFill}
          />
        </TabsContent>
      </Tabs>

      {/* Sticky Save Bar */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 40,
          borderTop: '3px solid #111',
          background: '#EFE7D6',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 12,
        }}
      >
        {!hasPending && !saving && (
          <span style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: '#555' }}>
            changes auto-saved
          </span>
        )}
        {hasPending && (
          <span style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: '#7A5A00' }}>
            unsaved changes...
          </span>
        )}
        <VqButton type="submit" variant="primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save Brain'}
        </VqButton>
      </div>

      {/* Add Knowledge Dialog */}
      <AddKnowledgeDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={knowledge.addItem}
      />
    </form>
  )
}
