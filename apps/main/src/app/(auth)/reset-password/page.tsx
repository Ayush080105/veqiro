"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, Suspense } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import Logo from "@/components/logo";
import { Button, FieldLabel, FONT, Sticker, VqInput } from "@/components/veqiro/shared";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const mismatch = Boolean(confirmPassword && newPassword !== confirmPassword);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error("Invalid reset link");
      return;
    }
    setIsLoading(true);
    const { error } = await authClient.resetPassword({ token, newPassword });
    setIsLoading(false);
    if (error) {
      toast.error(error.message || "Something went wrong");
    } else {
      toast.success("Password reset successfully");
      router.push("/login");
    }
  };

  if (!token) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-4"
        style={{ background: "#EFE7D6", fontFamily: FONT.body }}
      >
        <div
          className="w-full max-w-md"
          style={{
            background: "#FFF9ED",
            border: "3px solid #111",
            borderRadius: 18,
            boxShadow: "6px 6px 0 #111",
            padding: "32px 28px",
            textAlign: "center",
          }}
        >
          <Logo className="w-14 h-14 mx-auto mb-4" />
          <h1
            style={{
              fontFamily: FONT.display,
              fontSize: 32,
              color: "#111",
              margin: 0,
              letterSpacing: -1,
            }}
          >
            invalid link
          </h1>
          <p
            style={{
              fontFamily: FONT.body,
              fontSize: 14,
              color: "#555",
              marginTop: 8,
              marginBottom: 20,
            }}
          >
            This password reset link is invalid or has expired.
          </p>
          <Button variant="primary" onClick={() => router.replace("/forgot-password")}>
            Request new link
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
      style={{ background: "#EFE7D6", fontFamily: FONT.body }}
    >
      <Link href="/" className="flex items-center gap-3 mb-8">
        <Logo className="w-12 h-12" />
        <span style={{ fontFamily: FONT.head, fontSize: 20, letterSpacing: -0.5, color: "#111" }}>
          veqiro
        </span>
      </Link>

      <div
        className="w-full max-w-md relative"
        style={{
          background: "#FFF9ED",
          border: "3px solid #111",
          borderRadius: 18,
          boxShadow: "6px 6px 0 #111",
          padding: "32px 28px",
        }}
      >
        <div style={{ position: "absolute", top: -20, right: 20 }}>
          <Sticker rot={6} color="#1DBC87">
            new password
          </Sticker>
        </div>

        <h1
          style={{
            fontFamily: FONT.display,
            fontSize: 36,
            color: "#111",
            margin: 0,
            letterSpacing: -1,
            textAlign: "center",
          }}
        >
          reset password
        </h1>
        <p
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "#555",
            marginTop: 8,
            marginBottom: 24,
            textAlign: "center",
          }}
        >
          {"// pick a fresh one"}
        </p>

        <form onSubmit={onSubmit}>
          <FieldLabel label="New password" hint="Must be at least 8 characters long">
            <VqInput
              type="password"
              value={newPassword}
              onChange={setNewPassword}
              placeholder="••••••••"
              autoComplete="new-password"
              required
              disabled={isLoading}
            />
          </FieldLabel>

          <FieldLabel label="Confirm new password">
            <VqInput
              type="password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="••••••••"
              autoComplete="new-password"
              required
              disabled={isLoading}
            />
          </FieldLabel>
          {mismatch && (
            <div
              style={{
                marginTop: -12,
                marginBottom: 16,
                color: "#7A1717",
                fontFamily: FONT.mono,
                fontSize: 11,
              }}
            >
              Passwords do not match
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.replace("/login")}
              style={{ flex: 1 }}
            >
              Back
            </Button>
            <Button type="submit" variant="primary" disabled={isLoading || mismatch} style={{ flex: 1.3 }}>
              {isLoading ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <Loader2 className="size-4 animate-spin" /> Resetting…
                </span>
              ) : (
                "Reset password"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordForm() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: "#EFE7D6" }}
        >
          <Loader2 className="h-10 w-10 animate-spin" style={{ color: "#111" }} />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
