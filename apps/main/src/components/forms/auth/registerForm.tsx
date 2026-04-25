"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { registerSchema, type RegisterValues } from "@/lib/schemas/auth"
import { authClient } from "@/lib/auth-client"
import OAuthButtons from "@/components/oauth-buttons"
import { AuthCard } from "@/components/ui/auth-card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Field, FieldDescription, FieldError } from "@/components/ui/field"
import { SubmitButton } from "@/components/ui/submit-button"

export function RegisterForm() {
  const router = useRouter()

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  })

  const onSubmit = async (data: RegisterValues) => {
    const { data: result, error } = await authClient.signUp.email({
      email: data.email,
      password: data.password,
      name: data.name,
      callbackURL: "/onboarding",
    })
    if (error) {
      toast.error(error.message || "Something went wrong")
      return
    }
    form.reset()
    // Better Auth deliberately returns a phantom-success for already-registered
    // emails (anti-enumeration) AND when email verification is required no
    // session is created on signup. In both cases `result.token` is null/absent.
    // Don't push to /onboarding — the user has no session and would just bounce
    // to /login. Send them to /login with a "check your inbox" message instead.
    if (result?.token) {
      toast.success("Account created")
      router.push("/onboarding")
    } else {
      toast.success("Check your email to verify your account, then sign in.")
      router.push("/login")
    }
  }

  const isSubmitting = form.formState.isSubmitting

  return (
    <>
      <AuthCard.Header
        kicker="six AI employees, one login"
        title="join the crew"
      />

      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <Label htmlFor="name" variant="brand">Full name</Label>
              <Input
                id="name"
                variant="brand"
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                onBlur={field.onBlur}
                placeholder="Jane Doe"
                autoComplete="name"
                disabled={isSubmitting}
                aria-invalid={!!fieldState.error}
              />
              {fieldState.error && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <Label htmlFor="email" variant="brand">Email</Label>
              <Input
                id="email"
                type="email"
                variant="brand"
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                onBlur={field.onBlur}
                placeholder="name@example.com"
                autoComplete="email"
                disabled={isSubmitting}
                aria-invalid={!!fieldState.error}
              />
              <FieldDescription>
                We will send a verification link to your email.
              </FieldDescription>
              {fieldState.error && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <Label htmlFor="password" variant="brand">Password</Label>
              <Input
                id="password"
                type="password"
                variant="brand"
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                onBlur={field.onBlur}
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={isSubmitting}
                aria-invalid={!!fieldState.error}
              />
              {fieldState.error && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="confirmPassword"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <Label htmlFor="confirmPassword" variant="brand">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                variant="brand"
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                onBlur={field.onBlur}
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={isSubmitting}
                aria-invalid={!!fieldState.error}
              />
              {fieldState.error && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <SubmitButton isLoading={isSubmitting} loadingText="Creating account…">
          Create account
        </SubmitButton>

        <div className="flex items-center gap-3 py-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          <div className="h-0 flex-1 border-t-2 border-dashed border-foreground/40" />
          <span>or</span>
          <div className="h-0 flex-1 border-t-2 border-dashed border-foreground/40" />
        </div>

        <OAuthButtons />
      </form>

      <AuthCard.Footer>
        Already on the team?{" "}
        <Link
          href="/login"
          className="font-head uppercase tracking-wider underline underline-offset-4"
        >
          Login
        </Link>
      </AuthCard.Footer>
    </>
  )
}
