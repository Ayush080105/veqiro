import { notFound } from "next/navigation"

export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound()
  return <main className="min-h-screen bg-background text-foreground">{children}</main>
}
