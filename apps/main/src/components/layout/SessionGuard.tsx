"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { authClient } from "@/lib/auth-client"

export default function SessionGuard({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()

  useEffect(() => {
    if (isPending) return
    if (!session?.user) router.replace("/login")
  }, [session, isPending, router])

  if (isPending || !session?.user) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "#EFE7D6" }}
      >
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#111" }} />
      </div>
    )
  }

  return <>{children}</>
}
