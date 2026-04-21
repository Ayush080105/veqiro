"use client";

import { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { EyeIcon, EyeOffIcon, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { loginSchema } from "@/models/auth/loginSchema";
import OAuthButtons from "@/components/oauth-buttons";
import { Button, FieldLabel, FONT, VqInput } from "@/components/veqiro/shared";

export function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: false },
  });

  const onSubmit = async (data: z.infer<typeof loginSchema>) => {
    try {
      setError(null);
      setLoading(true);
      const { error: authErr } = await authClient.signIn.email({
        email: data.email,
        password: data.password,
        rememberMe: data.remember,
        callbackURL: "/dashboard",
      });
      if (authErr) {
        toast.error(authErr.message || "Something went wrong");
        setError(authErr.message || "Something went wrong");
      } else {
        toast.success("Login successful");
      }
      setLoading(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setError("Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: FONT.body }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h1
          style={{
            fontFamily: FONT.display,
            fontSize: 44,
            lineHeight: 1,
            color: "#111",
            margin: 0,
            letterSpacing: -1,
          }}
        >
          welcome back
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
          {"// sign in to your crew"}
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)}>
        {error && (
          <div
            style={{
              background: "#FFE0E0",
              border: "3px solid #111",
              borderRadius: 10,
              padding: "10px 14px",
              color: "#7A1717",
              fontFamily: FONT.mono,
              fontSize: 12,
              marginBottom: 16,
              boxShadow: "3px 3px 0 #F06464",
            }}
          >
            {error}
          </div>
        )}

        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <div>
              <FieldLabel label="Email">
                <VqInput
                  type="email"
                  value={field.value}
                  onChange={(v) => field.onChange(v)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  disabled={loading}
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
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 11,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    color: "#555",
                  }}
                >
                  Password
                </span>
                <Link
                  href="/forgot-password"
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 11,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    color: "#7A1717",
                    textDecoration: "underline",
                  }}
                >
                  Forgot?
                </Link>
              </div>
              <div style={{ position: "relative" }}>
                <VqInput
                  type={showPassword ? "text" : "password"}
                  value={field.value}
                  onChange={(v) => field.onChange(v)}
                  placeholder="••••••••"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "#111",
                    padding: 8,
                  }}
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
                <div
                  style={{
                    marginTop: 6,
                    color: "#7A1717",
                    fontFamily: FONT.mono,
                    fontSize: 11,
                  }}
                >
                  {fieldState.error.message}
                </div>
              )}
              <div style={{ height: 20 }} />
            </div>
          )}
        />

        <Controller
          name="remember"
          control={form.control}
          render={({ field }) => (
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 20,
                cursor: "pointer",
                fontFamily: FONT.mono,
                fontSize: 12,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: "#111",
              }}
            >
              <input
                type="checkbox"
                checked={Boolean(field.value)}
                onChange={(e) => field.onChange(e.target.checked)}
                disabled={loading}
                style={{
                  width: 18,
                  height: 18,
                  accentColor: "#111",
                  cursor: "pointer",
                }}
              />
              Remember me
            </label>
          )}
        />

        <Button type="submit" variant="primary" disabled={loading} style={{ width: "100%" }}>
          {loading ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Loader2 className="size-4 animate-spin" /> Signing in…
            </span>
          ) : (
            "Login"
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
          Don&apos;t have an account?{" "}
          <Link href="/signup" style={{ fontFamily: FONT.head, textTransform: "uppercase", letterSpacing: 1, color: "#111", textDecoration: "underline" }}>
            Sign up
          </Link>
        </div>
      </form>
    </div>
  );
}
