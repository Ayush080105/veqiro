"use client"

import { useState } from "react"
import Link from "next/link"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { loginSchema, type LoginValues } from "@/lib/schemas/auth"
import OAuthButtons from "@/components/oauth-buttons"
import { AuthCard } from "@/components/ui/auth-card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Field, FieldError } from "@/components/ui/field"
import { SubmitButton } from "@/components/ui/submit-button"

export function LoginForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: false },
  })

  const onSubmit = async (data: LoginValues) => {
    try {
      setError(null)
      setLoading(true)
      const { error: authErr } = await authClient.signIn.email({
        email: data.email,
        password: data.password,
        rememberMe: data.remember,
        // "/" lets proxy.ts decide where to send them — onboarded users go
        // to /dashboard, everyone else to /onboarding. Hardcoding /onboarding
        // here used to bounce already-onboarded users to the onboarding page
        // for a confusing flash before the layout guard caught up.
        callbackURL: "/dashboard",
      })
      if (authErr) {
        toast.error(authErr.message || "Something went wrong")
        setError(authErr.message || "Something went wrong")
      } else {
        toast.success("Login successful")
      }
      setLoading(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
      setError("Something went wrong")
      setLoading(false)
    }
  }

  return (
    <>
      <AuthCard.Header
        kicker="sign in to your crew"
        title="welcome back"
      />

      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {error && (
          <div className="rounded-md border-[3px] border-foreground bg-destructive/15 px-3.5 py-2.5 font-mono text-xs text-foreground shadow-[3px_3px_0_var(--destructive)]">
            {error}
          </div>
        )}

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
                disabled={loading}
                aria-invalid={!!fieldState.error}
              />
              {fieldState.error && (
                <FieldError errors={[fieldState.error]} />
              )}
            </Field>
          )}
        />

        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <div className="flex items-center justify-between">
                <Label htmlFor="password" variant="brand">Password</Label>
                <Link
                  href="/forgot-password"
                  className="font-mono text-[11px] uppercase tracking-wider text-destructive underline-offset-2 hover:underline"
                >
                  Forgot?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  variant="brand"
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  onBlur={field.onBlur}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={loading}
                  aria-invalid={!!fieldState.error}
                  className="pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-foreground hover:bg-foreground/5"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOffIcon className="size-4" />
                  ) : (
                    <EyeIcon className="size-4" />
                  )}
                </button>
              </div>
              {fieldState.error && (
                <FieldError errors={[fieldState.error]} />
              )}
            </Field>
          )}
        />

        <Controller
          name="remember"
          control={form.control}
          render={({ field }) => (
            <label className="flex cursor-pointer items-center gap-2 font-mono text-xs uppercase tracking-wider text-foreground">
              <input
                type="checkbox"
                checked={Boolean(field.value)}
                onChange={(e) => field.onChange(e.target.checked)}
                disabled={loading}
                className="size-[18px] cursor-pointer accent-foreground"
              />
              Remember me
            </label>
          )}
        />

        <SubmitButton isLoading={loading} loadingText="Signing in…">
          Login
        </SubmitButton>

        <div className="flex items-center gap-3 py-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          <div className="h-0 flex-1 border-t-2 border-dashed border-foreground/40" />
          <span>or</span>
          <div className="h-0 flex-1 border-t-2 border-dashed border-foreground/40" />
        </div>

        <OAuthButtons />
      </form>

      <AuthCard.Footer>
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-head uppercase tracking-wider underline underline-offset-4"
        >
          Sign up
        </Link>
      </AuthCard.Footer>
    </>
  )
}
