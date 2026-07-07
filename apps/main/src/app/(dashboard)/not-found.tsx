import Link from "next/link"

import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"

export default function DashboardNotFound() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        kicker="oops"
        title="Page not found"
        subtitle="There's nothing here — the page may have moved, or never existed in the first place."
        sticker={{ label: "404", rot: -4, color: "var(--vq-red)" }}
      />

      <div className="px-3.5 py-4 bg-card border-2 border-dashed border-foreground rounded-xl font-body text-[13px] text-foreground flex flex-col gap-3 items-start">
        <span className="font-mono text-[11px] tracking-[0.1em] text-muted-foreground">
          {"// nothing to see here"}
        </span>
        <span>
          Double-check the link, or head back to your dashboard.
        </span>
        <Button asChild variant="brand-dark" size="brand-sm">
          <Link href="/dashboard">back to dashboard -&gt;</Link>
        </Button>
      </div>
    </div>
  )
}
