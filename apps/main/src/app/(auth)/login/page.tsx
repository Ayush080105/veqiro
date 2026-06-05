import { AuthShell } from "@/components/auth-shell"
import { LoginForm } from "@/components/forms/auth/loginForm"
import { AuthCard } from "@/components/ui/auth-card"

export default function LoginPage() {
  return (
    <AuthShell showcaseSide="right">
      <AuthCard>
        <LoginForm />
      </AuthCard>
    </AuthShell>
  )
}
