import type { Metadata } from "next"

import { PublicDashboardView } from "@/components/agents/rex/dashboards/PublicDashboardView"

type Props = { params: Promise<{ token: string }> }

async function fetchMeta(token: string): Promise<{ title: string; description: string | null } | null> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/agents/rex/dashboards/public/${encodeURIComponent(token)}`,
      { next: { revalidate: 60 } },
    )
    if (!res.ok) return null
    return (await res.json()) as { title: string; description: string | null }
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  const d = await fetchMeta(token)
  if (!d) return { title: "Dashboard not found · Veqiro", robots: { index: false } }
  const description = d.description || "A live dashboard built with Veqiro."
  return {
    title: `${d.title} · Veqiro`,
    description,
    // Shared by link, not published: keep it out of search results.
    robots: { index: false, follow: false },
    openGraph: { title: d.title, description, siteName: "Veqiro" },
  }
}

export default async function Page({ params }: Props) {
  const { token } = await params
  return <PublicDashboardView token={token} />
}
