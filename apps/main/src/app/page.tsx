import { getSession } from "@/lib/server-session";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  if (!session?.session?.activeOrganizationId) {
    redirect("/workspaces");
  }
  redirect("/dashboard");
}
