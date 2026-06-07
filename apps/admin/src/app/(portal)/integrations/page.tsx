import { requireAdminSession } from "@/lib/server-session";
import { IntegrationsClient } from "@/components/integrations/IntegrationsClient";

export default async function IntegrationsPage() {
  await requireAdminSession();
  return <IntegrationsClient />;
}
