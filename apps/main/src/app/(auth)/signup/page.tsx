"use client";
import Link from "next/link";
import LoginBg from "@/components/login-bg";
import Logo from "@/components/logo";
import { RegisterForm } from "@/components/forms/auth/registerForm";
import { FONT, Sticker } from "@/components/veqiro/shared";

export default function SignupPage() {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2" style={{ background: "#EFE7D6" }}>
      {/* Left — decorative panel */}
      <div className="hidden lg:flex items-stretch h-full overflow-hidden">
        <LoginBg />
      </div>

      {/* Right — form */}
      <div className="flex flex-col gap-4 p-6 md:p-10 h-full relative overflow-hidden">
        <div className="flex justify-center md:justify-start items-center gap-3">
          <Link href="/" className="flex items-center gap-3 z-10">
            <Logo className="w-10 h-10" />
            <span style={{ fontFamily: FONT.head, fontSize: 18, letterSpacing: -0.5, color: "#111" }}>
              veqiro
            </span>
          </Link>
        </div>

        <div className="absolute top-10 right-10 hidden md:block">
          <Sticker rot={6} color="#F06464">
            new crew
          </Sticker>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div
            className="w-full max-w-md z-10"
            style={{
              background: "#FFF9ED",
              border: "3px solid #111",
              borderRadius: 18,
              boxShadow: "6px 6px 0 #111",
              padding: "32px 28px",
            }}
          >
            <RegisterForm />
          </div>
        </div>
      </div>
    </div>
  );
}
