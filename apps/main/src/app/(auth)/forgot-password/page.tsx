"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import Logo from "@/components/logo";
import { Button, FieldLabel, FONT, Sticker, VqInput } from "@/components/veqiro/shared";

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      });
      if (res.error) {
        toast.error(res.error.message || "Failed to send reset email");
        return;
      }
      toast.success("Reset link sent. Check your email.");
    } catch {
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

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
          <Sticker rot={-8} color="#F5C518">
            forgot it
          </Sticker>
        </div>

        <h1
          style={{
            fontFamily: FONT.display,
            fontSize: 36,
            lineHeight: 1,
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
          // we&apos;ll mail you a fresh link
        </p>

        <form onSubmit={submit}>
          <FieldLabel label="Email address">
            <VqInput
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              autoComplete="email"
              required
              disabled={isLoading}
            />
          </FieldLabel>

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.replace("/login")}
              style={{ flex: 1 }}
            >
              Back
            </Button>
            <Button type="submit" variant="primary" disabled={isLoading} style={{ flex: 1.3 }}>
              {isLoading ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <Loader2 className="size-4 animate-spin" /> Sending…
                </span>
              ) : (
                "Send link"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
