"use client";

import Link from "next/link";
import { Mail } from "lucide-react";
import Logo from "@/components/logo";
import { Button, FONT, Sticker } from "@/components/veqiro/shared";

export default function VerifyAccount() {
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
          // check spam if nothing shows
        </p>

        <div style={{ marginTop: 22 }}>
          <Button href="/login" variant="dark">
            Back to login
          </Button>
        </div>
      </div>
    </div>
  );
}
