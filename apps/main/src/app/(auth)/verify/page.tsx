"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, Mail, XCircle } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import Logo from "@/components/logo";
import { Button, FONT, Sticker } from "@/components/veqiro/shared";

type VerifyState = "check-inbox" | "verifying" | "success" | "error";

function Shell({ children }: { children: React.ReactNode }) {
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
        className="w-full max-w-md relative text-center"
        style={{
          background: "#FFF9ED",
          border: "3px solid #111",
          borderRadius: 18,
          boxShadow: "6px 6px 0 #111",
          padding: "36px 28px",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const errorParam = searchParams.get("error");

  const [state, setState] = useState<VerifyState>(() =>
    token ? "verifying" : errorParam ? "error" : "check-inbox"
  );
  const [errorMessage, setErrorMessage] = useState<string>(
    errorParam ? decodeURIComponent(errorParam.replace(/_/g, " ")) : ""
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await authClient.verifyEmail({
          query: { token },
        });
        if (cancelled) return;
        if (res.error) {
          setErrorMessage(res.error.message || "Verification failed");
          setState("error");
          return;
        }
        setState("success");
        toast.success("Email verified");
        // Backend has autoSignInAfterVerification: true — user should be signed in.
        setTimeout(() => {
          if (!cancelled) router.replace("/onboarding");
        }, 900);
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(err instanceof Error ? err.message : "Verification failed");
        setState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, router]);

  if (state === "verifying") {
    return (
      <Shell>
        <div
          className="mx-auto"
          style={{
            width: 72,
            height: 72,
            background: "#6FCDE8",
            border: "3px solid #111",
            borderRadius: 18,
            display: "grid",
            placeItems: "center",
            transform: "rotate(-4deg)",
            boxShadow: "4px 4px 0 #111",
          }}
        >
          <Loader2 className="h-9 w-9 animate-spin" style={{ color: "#111" }} />
        </div>
        <h1 style={{ fontFamily: FONT.display, fontSize: 36, color: "#111", margin: "24px 0 6px", letterSpacing: -1 }}>
          verifying…
        </h1>
        <p style={{ fontFamily: FONT.body, fontSize: 15, color: "#333", margin: 0 }}>
          Hang tight — we&apos;re confirming your email.
        </p>
      </Shell>
    );
  }

  if (state === "success") {
    return (
      <Shell>
        <div style={{ position: "absolute", top: -20, right: 20 }}>
          <Sticker rot={6} color="#1DBC87">
            verified
          </Sticker>
        </div>
        <div
          className="mx-auto"
          style={{
            width: 72,
            height: 72,
            background: "#1DBC87",
            border: "3px solid #111",
            borderRadius: 18,
            display: "grid",
            placeItems: "center",
            transform: "rotate(-4deg)",
            boxShadow: "4px 4px 0 #111",
          }}
        >
          <CheckCircle2 className="h-9 w-9" style={{ color: "#111" }} />
        </div>
        <h1 style={{ fontFamily: FONT.display, fontSize: 36, color: "#111", margin: "24px 0 6px", letterSpacing: -1 }}>
          you&apos;re in
        </h1>
        <p style={{ fontFamily: FONT.body, fontSize: 15, color: "#333", margin: 0 }}>
          Redirecting you to onboarding…
        </p>
      </Shell>
    );
  }

  if (state === "error") {
    return (
      <Shell>
        <div style={{ position: "absolute", top: -20, right: 20 }}>
          <Sticker rot={-6} color="#F06464">
            try again
          </Sticker>
        </div>
        <div
          className="mx-auto"
          style={{
            width: 72,
            height: 72,
            background: "#F06464",
            border: "3px solid #111",
            borderRadius: 18,
            display: "grid",
            placeItems: "center",
            transform: "rotate(-4deg)",
            boxShadow: "4px 4px 0 #111",
          }}
        >
          <XCircle className="h-9 w-9" style={{ color: "#111" }} />
        </div>
        <h1 style={{ fontFamily: FONT.display, fontSize: 36, color: "#111", margin: "24px 0 6px", letterSpacing: -1 }}>
          verification failed
        </h1>
        <p style={{ fontFamily: FONT.body, fontSize: 15, color: "#333", margin: "0 0 4px", lineHeight: 1.5 }}>
          {errorMessage || "This link may have expired or already been used."}
        </p>
        <p
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "#888",
            marginTop: 10,
          }}
        >
          {"// request a new link from login"}
        </p>
        <div style={{ marginTop: 22, display: "flex", gap: 10, justifyContent: "center" }}>
          <Button href="/login" variant="dark">
            Back to login
          </Button>
        </div>
      </Shell>
    );
  }

  // Default: "check inbox" for users right after signup (no token present)
  return (
    <Shell>
      <div style={{ position: "absolute", top: -20, left: 20 }}>
        <Sticker rot={-6} color="#F5C518">
          check inbox
        </Sticker>
      </div>

      <div
        className="mx-auto"
        style={{
          width: 72,
          height: 72,
          background: "#F5C518",
          border: "3px solid #111",
          borderRadius: 18,
          display: "grid",
          placeItems: "center",
          transform: "rotate(-4deg)",
          boxShadow: "4px 4px 0 #111",
        }}
      >
        <Mail className="h-9 w-9" style={{ color: "#111" }} />
      </div>

      <h1
        style={{
          fontFamily: FONT.display,
          fontSize: 36,
          color: "#111",
          margin: "24px 0 6px",
          letterSpacing: -1,
        }}
      >
        check your email
      </h1>
      <p
        style={{
          fontFamily: FONT.body,
          fontSize: 15,
          color: "#333",
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        We&apos;ve sent a verification link to your email. Click the link to
        activate your account.
      </p>
      <p
        style={{
          fontFamily: FONT.mono,
          fontSize: 11,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "#888",
          marginTop: 10,
        }}
      >
        {"// check spam if nothing shows"}
      </p>

      <div style={{ marginTop: 22 }}>
        <Button href="/login" variant="dark">
          Back to login
        </Button>
      </div>
    </Shell>
  );
}

export default function VerifyAccount() {
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
      <VerifyContent />
    </Suspense>
  );
}
