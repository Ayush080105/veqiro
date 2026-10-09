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
        title="Welcome back"
        subtitle="Sign in to pick up where your crew left off."
      />

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
        noValidate
      >
        {error && (
          <div
            role="alert"
            className="rounded-md border border-[var(--vq-line-2)] bg-destructive/15 px-3.5 py-2.5 font-body text-xs text-foreground"
          >
            {error}
          </div>
        )}

        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => {
            const errorId = fieldState.error ? "email-error" : undefined

            return (
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
                  aria-describedby={errorId}
                />
                {fieldState.error && (
                  <FieldError id="email-error" errors={[fieldState.error]} />
                )}
              </Field>
            )
          }}
        />

        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => {
            const errorId = fieldState.error ? "password-error" : undefined

            return (
              <Field>
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" variant="brand">Password</Label>
                  <Link
                    href="/forgot-password"
                    className="font-body text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
                  >
                    Forgot password?
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
                    placeholder="Password"
                    autoComplete="current-password"
                    disabled={loading}
                    aria-invalid={!!fieldState.error}
                    aria-describedby={errorId}
                    className="pr-14"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    disabled={loading}
                    className="absolute right-1.5 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-[var(--vq-r-sm)] text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOffIcon className="size-4" aria-hidden />
                    ) : (
                      <EyeIcon className="size-4" aria-hidden />
                    )}
                  </button>
                </div>
                {fieldState.error && (
                  <FieldError id="password-error" errors={[fieldState.error]} />
                )}
              </Field>
            )
          }}
        />

        <Controller
          name="remember"
          control={form.control}
          render={({ field }) => (
            <label className="flex min-h-10 cursor-pointer items-center gap-3 font-body text-sm text-foreground">
              <div className="relative size-5 shrink-0">
                <input
                  type="checkbox"
                  checked={Boolean(field.value)}
                  onChange={(e) => field.onChange(e.target.checked)}
                  disabled={loading}
                  className="peer size-5 cursor-pointer appearance-none rounded-[5px] border border-[var(--vq-line-2)] bg-card transition-colors checked:bg-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <svg
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden
                  className="pointer-events-none absolute inset-0 text-background opacity-0 transition-opacity peer-checked:opacity-100"
                >
                  <path
                    d="M2 6l3 3 5-5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              Remember me
            </label>
          )}
        />

        <SubmitButton isLoading={loading} loadingText="Signing in...">
          Sign in
        </SubmitButton>

        <div className="flex items-center gap-3 py-1 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-[var(--vq-line-2)]" />
          <span>or</span>
          <div className="h-px flex-1 bg-[var(--vq-line-2)]" />
        </div>

        <OAuthButtons />
      </form>

      <AuthCard.Footer>
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
        >
          Create one
        </Link>
      </AuthCard.Footer>
    </>
  )
}
