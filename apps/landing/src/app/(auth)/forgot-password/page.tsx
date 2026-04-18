"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/logo";
export default function ForgotPassword() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await authClient.requestPasswordReset({ email,redirectTo: "/reset-password" });
      if (res.error) {
        toast.error(res.error.message || "Failed to send reset email");
        return;
      }
      toast.success("Reset link sent! Check your email.");
    } catch (error) {
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen rounded-3xl flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center items-center gap-2">
          <Link href="/" className=" font-medium z-10">

            <Logo className="text-black dark:text-white h-20" />
          </Link>
        </div>

      </div>

      <div className="mt-8  sm:mx-auto sm:w-full sm:max-w-md">
        <div className="py-4 border bg-card  px-4 shadow-xl sm:rounded-lg sm:px-10">
          <div className="mb-8">
            <h2 className="mt-6 text-center text-3xl font-extrabold">
              Reset your password
            </h2>
            <p className="mt-2 text-center text-sm text-gray-400">
              Enter your email address and we&apos;ll send you a link to reset your
              password
            </p>
          </div>
          <form className="space-y-6" onSubmit={submit}>
            <div>
              <Label
                htmlFor="email"
                className="block text-sm font-medium text-muted-foreground"
              >
                Email address
              </Label>
              <div className="mt-2">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-center p-4">
              <Button
                variant="outline"
                onClick={() => router.replace("/login")}
              >
                Back to login
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Send Reset Link"
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
