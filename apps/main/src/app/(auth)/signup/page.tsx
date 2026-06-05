import { AuthShell } from "@/components/auth-shell"
import { RegisterForm } from "@/components/forms/auth/registerForm"
import { AuthCard } from "@/components/ui/auth-card"

export default function SignupPage() {
  return (
    <AuthShell showcaseSide="left">
      <AuthCard>
        <RegisterForm />
      </AuthCard>
    </AuthShell>
  )
}
