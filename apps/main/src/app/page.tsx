import { authClient } from "@/lib/auth-client";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await authClient.getSession();
  if (!session?.data?.user) {
    redirect("/login");
  }
  if (!session.data?.session?.activeOrganizationId) {
    redirect("/workspaces");
  }
  redirect("/dashboard");
}
