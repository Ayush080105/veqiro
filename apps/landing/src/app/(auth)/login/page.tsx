"use client";
import { LoginForm } from "@/components/forms/auth/loginForm";
import Link from "next/link";
import LoginBg from "@/components/login-bg";
import Logo from "@/components/logo";

export default function LoginPage() {
  
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2 bg-background">
      {/* Left side - Login Form */}
      <div className="flex flex-col gap-4 p-6 md:p-10 h-full relative overflow-hidden">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link href="/" className="flex items-center gap-2 font-medium z-10">
            
            <Logo className="w-10 h-10" />
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs z-10">
            <LoginForm />
          </div>
        </div>
      </div>

      {/* Right side - Bot Illustration */}
      <div className=" hidden lg:flex items-center justify-center h-full overflow-hidden">
        <LoginBg />
      </div>
    </div>
  );
}
