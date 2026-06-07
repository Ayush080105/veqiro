import { requireAdminSession } from "@/lib/server-session";
import { AgentsClient } from "@/components/agents/AgentsClient";

export default async function AgentsPage() {
  await requireAdminSession();
  return <AgentsClient />;
}
