import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--muted)]">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-[var(--border)] bg-[var(--card)] p-8 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold">Veqiro Admin</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Internal access only</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
