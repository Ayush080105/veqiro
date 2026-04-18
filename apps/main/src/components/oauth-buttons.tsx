"use client";

import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { useState } from "react";
import { Loader2 } from "lucide-react";

export default function OAuthButtons() {
  const [googleLoading, setGoogleLoading] = useState(false);
  return (
    <div className="">
      <Button
        variant="outline"
        type="button"
        className="w-full"
        onClick={() => {
          setGoogleLoading(true);
          signIn.social({ provider: "google", callbackURL: "/dashboard" });
        }}
      >
        {googleLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <Image src="/Google.svg" alt="Google" width={24} height={24} sizes="24px" />
          <span>Continue with Google </span>
          </>
        )}
      </Button>
    </div>
  );
}
