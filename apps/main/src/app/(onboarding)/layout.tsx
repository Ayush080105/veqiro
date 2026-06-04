import { redirect } from "next/navigation";
import { getSession } from "@/lib/server-session";

// Onboarding routes (the workspace picker) need the user to be signed in,
// but must NOT require an active organization — this is where they pick one.
export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  return <>{children}</>;
}
