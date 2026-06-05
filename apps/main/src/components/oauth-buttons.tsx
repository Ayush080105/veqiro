"use client"

import Image from "next/image"
import { useState } from "react"
import { Loader2 } from "lucide-react"

import { signIn } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"

function resolveClientCallbackURL(callbackURL: string) {
  if (/^https?:\/\//i.test(callbackURL)) return callbackURL

  const clientOrigin =
    (typeof window !== "undefined" ? window.location.origin : "") ||
    process.env.NEXT_PUBLIC_CONSOLE_URL

  return new URL(callbackURL, clientOrigin).toString()
}

export default function OAuthButtons({
  callbackURL = "/dashboard",
}: {
  callbackURL?: string
} = {}) {
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleClick = () => {
    setGoogleLoading(true)
    signIn.social({
      provider: "google",
      callbackURL: resolveClientCallbackURL(callbackURL),
    })
  }

  return (
    <Button
      type="button"
      variant="brand-ghost"
      size="brand"
      onClick={handleClick}
      disabled={googleLoading}
      className="min-h-12 w-full whitespace-normal text-center leading-tight shadow-[5px_5px_0_var(--foreground)] active:not-aria-[haspopup]:shadow-[3px_3px_0_var(--foreground)] sm:whitespace-nowrap"
    >
      {googleLoading ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Connecting
        </>
      ) : (
        <>
          <Image src="/Google.svg" alt="" width={20} height={20} aria-hidden />
          <span>Continue with Google</span>
        </>
      )}
    </Button>
  )
}
