import Link from "next/link"

import LoginBg from "@/components/login-bg"
import Logo from "@/components/logo"
import { RegisterForm } from "@/components/forms/auth/registerForm"
import { AuthCard } from "@/components/ui/auth-card"
import { Sticker } from "@/components/ui/sticker"

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-2">
      {/* Left — decorative panel */}
      <div className="hidden h-full items-stretch overflow-hidden lg:flex">
        <LoginBg />
      </div>

      {/* Right — form */}
      <div className="relative flex h-full flex-col gap-4 overflow-hidden p-6 md:p-10">
        <div className="z-10 flex items-center justify-center gap-3 md:justify-start">
          <Link href="/" className="flex items-center gap-3">
            <Logo className="h-10 w-10" />
            <span className="font-head text-lg tracking-tight text-foreground">
              veqiro
            </span>
          </Link>
        </div>

        <div className="absolute right-10 top-10 z-10 hidden md:block">
          <Sticker rotate={6} tone="red">
            new crew
          </Sticker>
        </div>

        <div className="z-10 flex flex-1 items-center justify-center">
          <AuthCard>
            <RegisterForm />
          </AuthCard>
        </div>
      </div>
    </div>
  )
}
