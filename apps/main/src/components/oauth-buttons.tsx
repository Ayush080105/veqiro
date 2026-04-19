"use client";

import { signIn } from "@/lib/auth-client";
import Image from "next/image";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { FONT } from "@/components/veqiro/shared";

export default function OAuthButtons() {
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleClick = () => {
    setGoogleLoading(true);
    signIn.social({ provider: "google", callbackURL: "/dashboard" });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={googleLoading}
      style={{
        width: "100%",
        padding: "12px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        background: "#FFF9ED",
        color: "#111",
        fontFamily: FONT.head,
        fontSize: 13,
        textTransform: "uppercase",
        letterSpacing: 1,
        border: "3px solid #111",
        borderRadius: 10,
        cursor: googleLoading ? "not-allowed" : "pointer",
        opacity: googleLoading ? 0.6 : 1,
        boxShadow: "4px 4px 0 #111",
        transition: "transform 120ms, box-shadow 120ms",
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = "translate(2px,2px)";
        e.currentTarget.style.boxShadow = "2px 2px 0 #111";
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = "";
        e.currentTarget.style.boxShadow = "4px 4px 0 #111";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "";
        e.currentTarget.style.boxShadow = "4px 4px 0 #111";
      }}
    >
      {googleLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <>
          <Image src="/Google.svg" alt="Google" width={20} height={20} />
          <span>Continue with Google</span>
        </>
      )}
    </button>
  );
}
