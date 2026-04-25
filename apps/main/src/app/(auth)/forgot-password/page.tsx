"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { CheckCircle2 } from "lucide-react"

import { authClient } from "@/lib/auth-client"
import Logo from "@/components/logo"
import { AuthCard } from "@/components/ui/auth-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Field } from "@/components/ui/field"
import { SubmitButton } from "@/components/ui/submit-button"
import { Sticker } from "@/components/ui/sticker"

export default function ForgotPassword() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : ""
      const res = await authClient.requestPasswordReset({
        email,
        redirectTo: `${origin}/reset-password`,
      })
      if (res.error) {
        toast.error(res.error.message || "Failed to send reset email")
        return
      }
      setSent(true)
      toast.success("Reset link sent. Check your email.")
    } catch {
      toast.error("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <Link href="/" className="mb-8 flex items-center gap-3">
        <Logo className="h-12 w-12" />
        <span className="font-head text-xl tracking-tight text-foreground">
          veqiro
        </span>
      </Link>

      <AuthCard sticker={<Sticker rotate={-8} tone="yellow">forgot it</Sticker>}>
        {sent ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <span
              className="grid size-16 place-items-center rounded-2xl border-[3px] border-foreground bg-[color:var(--vq-green)] shadow-[4px_4px_0_var(--foreground)]"
              style={{ transform: "rotate(-4deg)" }}
            >
              <CheckCircle2 className="size-8 text-foreground" />
            </span>
            <h1 className="m-0 font-display text-3xl leading-none tracking-tight text-foreground">
              check your email
            </h1>
            <p className="m-0 font-body text-sm leading-relaxed text-foreground/80">
              We sent a reset link to <strong>{email}</strong>. Click the link to
              choose a new password.
            </p>
            <p className="m-0 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              {"// check spam if nothing shows"}
            </p>
            <Button
              variant="brand-dark"
              size="brand"
              onClick={() => router.replace("/login")}
            >
              Back to login
            </Button>
          </div>
        ) : (
          <>
            <AuthCard.Header
              kicker="we'll mail you a fresh link"
              title="reset password"
            />
            <form onSubmit={submit} className="flex flex-col gap-4">
              <Field>
                <Label htmlFor="email" variant="brand">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  variant="brand"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  disabled={isLoading}
                />
              </Field>
              <div className="flex gap-2.5">
                <Button
                  type="button"
                  variant="brand-ghost"
                  size="brand"
                  onClick={() => router.replace("/login")}
                  className="flex-1"
                >
                  Back
                </Button>
                <SubmitButton
                  isLoading={isLoading}
                  loadingText="Sending…"
                  className="flex-[1.3]"
                >
                  Send link
                </SubmitButton>
              </div>
            </form>
          </>
        )}
      </AuthCard>
    </div>
  )
}
