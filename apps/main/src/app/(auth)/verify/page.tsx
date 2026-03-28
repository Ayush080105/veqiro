"use client";

import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function VerifyAccount() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-background px-4 sm:px-6 md:px-10">
      <div className="w-full max-w-md bg-card border rounded-xl shadow-lg py-10 px-5 sm:px-8">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="bg-primary/10 p-4 rounded-full">
            <Mail className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            Check your email
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            We&apos;ve sent a verification link to your email address. Click the
            link in the email to verify your account.
          </p>
          <p className="text-muted-foreground text-xs">
            Check your spam folder if you don&apos;t see the email.
          </p>
          <div className="pt-4">
            <Button  variant="outline">
              <Link href="/login">Back to Login</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
