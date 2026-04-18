"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { EyeIcon, EyeOffIcon, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { loginSchema } from "@/models/auth/loginSchema";
import OAuthButtons from "@/components/oauth-buttons";

export function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      remember: false,
    },
  });

  const onSubmit = async (data: z.infer<typeof loginSchema>) => {
    try {
    setError(null);
    setLoading(true);
    const { error } = await authClient.signIn.email({
      email: data.email,
      password: data.password,
      rememberMe: data.remember,
      callbackURL: "/dashboard",
    });
    if (error) {
      toast.error(error.message || "Something went wrong");
      setError(error.message || "Something went wrong");
    } else {
      toast.success("Login successful");
    }
    setLoading(false);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Something went wrong");
    setError("Something went wrong");
  }
  };

  return (
    <div>
      <div className="flex flex-col items-center gap-2 text-center py-2">
        <h1 className="text-2xl font-bold">Welcome back!</h1>
        <p className="text-muted-foreground text-sm text-balance">
          Enter your details to login to your account
        </p>
      </div>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {error && (
          <p className="text-destructive text-lg text-center mt-4 font-semibold">
            {error}
          </p>
        )}

        <FieldGroup>
          <Controller
            name="email"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="login-email">Email</FieldLabel>
                <Input
                  {...field}
                  id="login-email"
                  placeholder="name@example.com"
                  type="email"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect="off"
                  disabled={loading}
                  aria-invalid={fieldState.invalid}
                  className="h-11"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="password"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel
                  htmlFor="login-password"
                  className="flex items-center justify-between"
                >
                  <span className="text-muted-foreground">Password</span>
                  <Link
                    href="/forgot-password"
                    className="hover:underline hover:underline-offset-4"
                  >
                    Forgot password?
                  </Link>
                </FieldLabel>
                <InputGroup className="h-11">
                  <InputGroupInput
                    {...field}
                    id="login-password"
                    placeholder="••••••••"
                    type={showPassword ? "text" : "password"}
                    disabled={loading}
                    aria-invalid={fieldState.invalid}
                    className="h-11"
                  />
                  <InputGroupButton
                    onClick={() => setShowPassword(!showPassword)}
                    className="cursor-pointer mr-2"
                  >
                    {showPassword ? (
                      <EyeOffIcon className="size-4" />
                    ) : (
                      <EyeIcon className="size-4" />
                    )}
                  </InputGroupButton>
                </InputGroup>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="remember"
            control={form.control}
            render={({ field }) => (
              <Field orientation="horizontal">
                <Checkbox
                  id="login-remember"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={loading}
                />
                <FieldLabel htmlFor="login-remember" className="font-normal">
                  Remember me
                </FieldLabel>
              </Field>
            )}
          />
        </FieldGroup>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <span>Login</span>
          )}
        </Button>

        <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
          <span className="bg-background text-muted-foreground relative z-10 px-2">
            Or
          </span>
        </div>
        <OAuthButtons />
        <div className="text-center text-sm">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="underline underline-offset-4">
            Sign up
          </Link>
        </div>
      </form>
    </div>
  );
}
