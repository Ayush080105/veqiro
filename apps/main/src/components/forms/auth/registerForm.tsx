"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { registerSchema } from "@/models/auth/registerSchema";
import { authClient } from "@/lib/auth-client";
import OAuthButtons from "@/components/oauth-buttons";
import { Button, FieldLabel, FONT, VqInput } from "@/components/veqiro/shared";

export function RegisterForm() {
  const router = useRouter();

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = async (data: z.infer<typeof registerSchema>) => {
    const { error } = await authClient.signUp.email({
      email: data.email,
      password: data.password,
      name: data.name,
      callbackURL: "/onboarding",
    });
    if (error) {
      toast.error(error.message || "Something went wrong");
      return;
    }
    toast.success("Account created");
    form.reset();
    // New users land on onboarding; existing users skipping signup and
    // already logged in hit the session-gated onboarding page which
    // redirects to /dashboard if their brand kit is already populated.
    router.push("/onboarding");
  };

  const isSubmitting = form.formState.isSubmitting;

  return (
    <div style={{ fontFamily: FONT.body }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h1
          style={{
            fontFamily: FONT.display,
            fontSize: 40,
            lineHeight: 1,
            color: "#111",
            margin: 0,
            letterSpacing: -1,
          }}
        >
          join the crew
        </h1>
        <p
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "#555",
            marginTop: 8,
          }}
        >
          // six AI employees, one login
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <div>
              <FieldLabel label="Full name">
                <VqInput
                  value={field.value}
                  onChange={(v) => field.onChange(v)}
                  placeholder="Jane Doe"
                  autoComplete="name"
                  disabled={isSubmitting}
                />
              </FieldLabel>
              {fieldState.error && (
                <div
                  style={{
                    marginTop: -12,
                    marginBottom: 20,
                    color: "#7A1717",
                    fontFamily: FONT.mono,
                    fontSize: 11,
                  }}
                >
                  {fieldState.error.message}
                </div>
              )}
            </div>
          )}
        />

        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <div>
              <FieldLabel label="Email" hint="We will send a verification link to your email">
                <VqInput
                  type="email"
                  value={field.value}
                  onChange={(v) => field.onChange(v)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  disabled={isSubmitting}
                />
              </FieldLabel>
              {fieldState.error && (
                <div
                  style={{
                    marginTop: -12,
                    marginBottom: 20,
                    color: "#7A1717",
                    fontFamily: FONT.mono,
                    fontSize: 11,
                  }}
                >
                  {fieldState.error.message}
                </div>
              )}
            </div>
          )}
        />

        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <div>
              <FieldLabel label="Password">
                <VqInput
                  type="password"
                  value={field.value}
                  onChange={(v) => field.onChange(v)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  disabled={isSubmitting}
                />
              </FieldLabel>
              {fieldState.error && (
                <div
                  style={{
                    marginTop: -12,
                    marginBottom: 20,
                    color: "#7A1717",
                    fontFamily: FONT.mono,
                    fontSize: 11,
                  }}
                >
                  {fieldState.error.message}
                </div>
              )}
            </div>
          )}
        />

        <Controller
          name="confirmPassword"
          control={form.control}
          render={({ field, fieldState }) => (
            <div>
              <FieldLabel label="Confirm password">
                <VqInput
                  type="password"
                  value={field.value}
                  onChange={(v) => field.onChange(v)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  disabled={isSubmitting}
                />
              </FieldLabel>
              {fieldState.error && (
                <div
                  style={{
                    marginTop: -12,
                    marginBottom: 20,
                    color: "#7A1717",
                    fontFamily: FONT.mono,
                    fontSize: 11,
                  }}
                >
                  {fieldState.error.message}
                </div>
              )}
            </div>
          )}
        />

        <Button type="submit" variant="primary" disabled={isSubmitting} style={{ width: "100%" }}>
          {isSubmitting ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Loader2 className="size-4 animate-spin" /> Creating account…
            </span>
          ) : (
            "Create account"
          )}
        </Button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            margin: "20px 0 16px",
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "#888",
          }}
        >
          <div style={{ flex: 1, height: 0, borderTop: "2px dashed #111", opacity: 0.5 }} />
          <span>or</span>
          <div style={{ flex: 1, height: 0, borderTop: "2px dashed #111", opacity: 0.5 }} />
        </div>

        <OAuthButtons />

        <div
          style={{
            marginTop: 20,
            textAlign: "center",
            fontFamily: FONT.body,
            fontSize: 14,
            color: "#111",
          }}
        >
          Already on the team?{" "}
          <Link href="/login" style={{ fontFamily: FONT.head, textTransform: "uppercase", letterSpacing: 1, color: "#111", textDecoration: "underline" }}>
            Login
          </Link>
        </div>
      </form>
    </div>
  );
}
