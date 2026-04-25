"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { useState, Suspense } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import Logo from "@/components/logo"
import { AuthCard } from "@/components/ui/auth-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Field, FieldDescription, FieldError } from "@/components/ui/field"
import { SubmitButton } from "@/components/ui/submit-button"
import { Sticker } from "@/components/ui/sticker"

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const mismatch = Boolean(confirmPassword && newPassword !== confirmPassword)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) {
      toast.error("Invalid reset link")
      return
    }
    setIsLoading(true)
    const { error } = await authClient.resetPassword({ token, newPassword })
    setIsLoading(false)
    if (error) {
      toast.error(error.message || "Something went wrong")
    } else {
      toast.success("Password reset successfully")
      router.push("/login")
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <AuthCard>
          <div className="flex flex-col items-center gap-3 text-center">
            <Logo className="mx-auto h-14 w-14" />
            <h1 className="m-0 font-display text-3xl leading-none tracking-tight text-foreground">
              invalid link
            </h1>
            <p className="m-0 font-body text-sm leading-relaxed text-muted-foreground">
              This password reset link is invalid or has expired.
            </p>
            <Button
              variant="brand"
              size="brand"
              onClick={() => router.replace("/forgot-password")}
            >
              Request new link
            </Button>
          </div>
        </AuthCard>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <Link href="/" className="mb-8 flex items-center gap-3">
        <Logo className="h-12 w-12" />
        <span className="font-head text-xl tracking-tight text-foreground">
          veqiro
        </span>
      </Link>

      <AuthCard sticker={<Sticker rotate={6} tone="green">new password</Sticker>}>
        <AuthCard.Header
          kicker="pick a fresh one"
          title="reset password"
        />
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field>
            <Label htmlFor="newPassword" variant="brand">New password</Label>
            <Input
              id="newPassword"
              type="password"
              variant="brand"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              required
              disabled={isLoading}
            />
            <FieldDescription>Must be at least 8 characters long.</FieldDescription>
          </Field>

          <Field>
            <Label htmlFor="confirmPassword" variant="brand">Confirm new password</Label>
            <Input
              id="confirmPassword"
              type="password"
              variant="brand"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              required
              disabled={isLoading}
              aria-invalid={mismatch}
            />
            {mismatch && (
              <FieldError>Passwords do not match</FieldError>
            )}
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
              loadingText="Resetting…"
              disabled={mismatch}
              className="flex-[1.3]"
            >
              Reset password
            </SubmitButton>
          </div>
        </form>
      </AuthCard>
    </div>
  )
}

export default function ResetPasswordForm() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="size-10 animate-spin text-foreground" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  )
}
