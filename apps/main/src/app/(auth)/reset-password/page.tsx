"use client"

import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { authClient } from "@/lib/auth-client"
import { AuthShell } from "@/components/auth-shell"
import { AuthCard } from "@/components/ui/auth-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SubmitButton } from "@/components/ui/submit-button"
import { RhfField } from "@/components/forms/RhfField"
import { resetPasswordSchema, type ResetPasswordValues } from "@/lib/schemas/auth"
import Link from "next/link"
import Logo from "@/components/logo"
import { Sticker } from "@/components/ui/sticker"

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token")

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  })

  const onSubmit = async ({ newPassword }: ResetPasswordValues) => {
    if (!token) {
      toast.error("Invalid reset link")
      return
    }
    const { error } = await authClient.resetPassword({ token, newPassword })
    if (error) {
      toast.error(error.message || "Something went wrong")
    } else {
      toast.success("Password reset successfully")
      router.push("/login")
    }
  }

  if (!token) {
    return (
      <div className="flex gap-4 min-h-screen flex-col items-center justify-center bg-background px-4">
          <Link href="/" className="flex items-center gap-3 text-foreground">
            <Logo className="size-10 shrink-0" />
            <span className="font-display text-3xl leading-none tracking-normal">
              veqiro
            </span>
          </Link>
        <AuthCard>
          <div className="flex flex-col items-center gap-3 text-center">
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
      <Link href="/" className="flex items-center gap-3 text-foreground">
            <Logo className="size-10 shrink-0" />
            <span className="font-display text-3xl leading-none tracking-normal">
              veqiro
            </span>
          </Link>

      <AuthCard sticker={<Sticker rotate={6} tone="green">new password</Sticker>}>
        <AuthCard.Header
          kicker="pick a fresh one"
          title="reset password"
        />
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <RhfField
            control={form.control}
            name="newPassword"
            label="New password"
            description="Must be at least 8 characters long."
            required
          >
            {({ field, invalid, id }) => (
              <Input
                {...field}
                id={id}
                type="password"
                variant="brand"
                placeholder="New password"
                autoComplete="new-password"
                aria-invalid={invalid}
                disabled={form.formState.isSubmitting}
              />
            )}
          </RhfField>

          <RhfField
            control={form.control}
            name="confirmPassword"
            label="Confirm new password"
            required
          >
            {({ field, invalid, id }) => (
              <Input
                {...field}
                id={id}
                type="password"
                variant="brand"
                placeholder="Confirm new password"
                autoComplete="new-password"
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
              loadingText="Resetting..."
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
