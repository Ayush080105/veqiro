"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CheckCircle2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { authClient } from "@/lib/auth-client"
import { AuthShell } from "@/components/auth-shell"
import { AuthCard } from "@/components/ui/auth-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SubmitButton } from "@/components/ui/submit-button"
import { RhfField } from "@/components/forms/RhfField"
import { forgotPasswordSchema, type ForgotPasswordValues } from "@/lib/schemas/auth"
import Link from "next/link"
import Logo from "@/components/logo"
import { Sticker } from "@/components/ui/sticker"

export default function ForgotPassword() {
  const router = useRouter()
  const [sentEmail, setSentEmail] = useState<string | null>(null)

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  })

  const onSubmit = async ({ email }: ForgotPasswordValues) => {
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
      setSentEmail(email)
      toast.success("Reset link sent. Check your email.")
    } catch {
      toast.error("An error occurred. Please try again.")
    }
  }

  return (
    <div className="flex min-h-screen flex-col gap-4 items-center justify-center bg-background px-4 py-10">
      <Link href="/" className="flex items-center gap-3 text-foreground">
        <span className="grid size-10 shrink-0 rotate-[-6deg] place-items-center rounded-[10px] bg-foreground shadow-[3px_3px_0_var(--vq-yellow)]">
          <span className="font-display text-[23px] leading-none text-background">
            v
          </span>
        </span>
        <span className="font-display text-3xl leading-none tracking-normal">
          veqiro
        </span>
      </Link>

      <AuthCard sticker={<Sticker rotate={-8} tone="yellow">forgot it</Sticker>}>
        {sentEmail ? (
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
              We sent a reset link to <strong>{sentEmail}</strong>. Click the
              link to choose a new password.
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
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-4"
            >
              <RhfField
                control={form.control}
                name="email"
                label="Email address"
                required
              >
                {({ field, invalid, id }) => (
                  <Input
                    {...field}
                    id={id}
                    type="email"
                    variant="brand"
                    placeholder="you@example.com"
                    autoComplete="email"
                    aria-invalid={invalid}
                    disabled={form.formState.isSubmitting}
                  />
                )}
              </RhfField>
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
                  isLoading={form.formState.isSubmitting}
                  loadingText="Sending..."
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
