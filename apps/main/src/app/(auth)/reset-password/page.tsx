"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, Suspense } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import Logo from "@/components/logo";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    if (!token) {
      toast.error("Invalid reset link");
      setIsLoading(false);
      return;
    }
    const { error } = await authClient.resetPassword({
      token,
      newPassword,
    });
    if (error) {
      toast.error(error.message || "Something went wrong");
    } else {
      toast.success("Password reset successfully");
      router.push("/login");
    }
    setIsLoading(false);
  };
  if (!token) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <Image
              src="/logo.svg"
              alt="VoiceAgents Logo"
              width={48}
              height={48}
              className="h-12 w-auto"
            />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold ">
            Invalid Reset Link
          </h2>
          <p className="mt-2 text-center text-base">
            This password reset link is invalid or has expired.
          </p>
          <div className="mt-6 text-center">
            <Button onClick={() => router.replace("/forgot-password")}>
              Request a new reset link
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-center ">
      <div className=" sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-card py-8 px-4 shadow-xl sm:rounded-lg sm:px-10 border">
          <div className="mb-8">
          <Logo className="text-black dark:text-white h-20" />
            <h2 className="mt-6 text-center text-3xl font-extrabold">
              Reset your password
            </h2>
            <p className="mt-2 text-center text-base">
              Enter your new password below
            </p>
          </div>
          <form className="space-y-6 py-4" onSubmit={onSubmit}>
            <div>
              <Label
                htmlFor="newPassword"
                className="block text-sm font-medium "
              >
                New Password
              </Label>
              <div className="mt-2">
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <p className="mt-2 text-sm text-gray-400">
                Must be at least 8 characters long
              </p>
            </div>

            <div>
              <Label
                htmlFor="confirmPassword"
                className="block text-sm font-medium "
              >
                Confirm New Password
              </Label>
              <div className="mt-2">
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={` ${
                    confirmPassword && newPassword !== confirmPassword
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                      : "border-gray-700"
                  }`}
                  placeholder="••••••••"
                />
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="mt-2 text-sm text-red-400">
                  Passwords do not match
                </p>
              )}
            </div>

            <div className="w-full justify-center flex gap-2">
              <Button
                variant="outline"
                onClick={() => router.replace("/login")}
              >
                Back to login
              </Button>
              <Button
                type="submit"
                disabled={Boolean(
                  isLoading ||
                    (confirmPassword && newPassword !== confirmPassword)
                )}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin"></Loader2>
                ) : (
                  "Reset Password"
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordForm() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <div className="animate-spin h-12 w-12 text-blue-500">
            <Loader2 className="h-12 w-12 text-blue-500" />
          </div>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
